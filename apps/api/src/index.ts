import cors from "cors";
import express from "express";
import {
  LoginSchema,
  TicketCreateSchema,
  TicketPatchSchema,
  UserLocationSchema,
  type Ticket,
  type TicketStatus,
} from "@stf/shared";

const app = express();
const port = Number(process.env.PORT ?? 3009);

app.use(
  cors({
    origin: ["http://localhost:3008"],
    credentials: true,
  }),
);
app.use(express.json());

const statusFlow: TicketStatus[] = ["abierto", "en_proceso", "resuelto"];

let tickets: Ticket[] = [
  {
    id: "TK-1001",
    title: "Fuga en baño ala A",
    description: "Se detecta fuga constante en lavabo principal.",
    status: "abierto",
    priority: "alta",
    category: "Plomería",
    wing: "a",
    floor: 2,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [{ id: "c1", text: "Reportado por recepción", at: new Date().toISOString() }],
    attachments: [],
    location: { x: 2, y: 0, z: -3 },
  },
  {
    id: "TK-1002",
    title: "Aire acondicionado no enfría",
    description: "Equipo sin enfriamiento en sala de juntas.",
    status: "en_proceso",
    priority: "media",
    category: "Climatización",
    wing: "b",
    floor: 3,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    attachments: [],
    location: { x: 6, y: 0, z: 1 },
  },
];

let userLocation = { wing: "a" as const, floor: 1, point: { x: 0, y: 0, z: 0 } };

app.post("/api/auth/login", (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Payload inválido", issues: parsed.error.flatten() });
  }

  return res.json({
    token: "mock-token-123",
    user: { id: "u1", name: "Usuario Finanzas", email: parsed.data.email },
  });
});

app.get("/api/me", (_req, res) => {
  return res.json({
    id: "u1",
    name: "Usuario Finanzas",
    email: "usuario@institucion.mx",
    location: userLocation,
  });
});

app.get("/api/tickets", (_req, res) => {
  return res.json({ data: tickets, total: tickets.length });
});

app.post("/api/tickets", (req, res) => {
  const parsed = TicketCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Payload inválido", issues: parsed.error.flatten() });
  }

  const now = new Date().toISOString();
  const newTicket: Ticket = {
    ...parsed.data,
    id: `TK-${Math.floor(Math.random() * 9000 + 1000)}`,
    status: "abierto",
    createdAt: now,
    updatedAt: now,
    comments: [],
    attachments: [],
  };

  tickets = [newTicket, ...tickets];
  return res.status(201).json(newTicket);
});

app.get("/api/tickets/:id", (req, res) => {
  const ticket = tickets.find((item) => item.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ message: "Ticket no encontrado" });
  }
  return res.json(ticket);
});

app.patch("/api/tickets/:id", (req, res) => {
  const parsed = TicketPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Payload inválido", issues: parsed.error.flatten() });
  }

  const idx = tickets.findIndex((item) => item.id === req.params.id);
  if (idx < 0) {
    return res.status(404).json({ message: "Ticket no encontrado" });
  }

  const current = tickets[idx];
  const nextStatus =
    parsed.data.status ??
    statusFlow[(statusFlow.indexOf(current.status) + 1) % statusFlow.length] ??
    current.status;

  tickets[idx] = {
    ...current,
    ...parsed.data,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    comments:
      parsed.data.commentText && parsed.data.commentText.trim()
        ? [
            ...current.comments,
            {
              id: `c-${Date.now()}`,
              text: parsed.data.commentText.trim(),
              at: new Date().toISOString(),
            },
          ]
        : current.comments,
  };

  return res.json(tickets[idx]);
});

app.post("/api/users/me/location", (req, res) => {
  const parsed = UserLocationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Payload inválido", issues: parsed.error.flatten() });
  }
  userLocation = parsed.data;
  return res.json({ ok: true, location: userLocation });
});

app.get("/health", (_req, res) => {
  return res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`API lista en http://localhost:${port}`);
});
