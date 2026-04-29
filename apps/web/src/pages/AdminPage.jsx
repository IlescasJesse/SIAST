import { useState } from "react";
import { Box, Tabs, Tab, Typography } from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SecurityIcon from "@mui/icons-material/Security";
import SyncIcon from "@mui/icons-material/Sync";
import { AdminUsuariosPage } from "./AdminUsuariosPage.jsx";
import { AdminProcesosPage } from "./AdminProcesosPage.jsx";
import { AdminSeguridadPage } from "./AdminSeguridadPage.jsx";
import { AdminSirhPage } from "./AdminSirhPage.jsx";

export const AdminPage = () => {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Administración
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gestión de usuarios, roles, permisos, procesos de atención y seguridad.
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tab icon={<PeopleIcon />} iconPosition="start" label="Usuarios" />
        <Tab icon={<AccountTreeIcon />} iconPosition="start" label="Procesos" />
        <Tab icon={<SecurityIcon />} iconPosition="start" label="Seguridad" />
        <Tab icon={<SyncIcon />} iconPosition="start" label="Sincronización SIRH" />
      </Tabs>

      {tab === 0 && <AdminUsuariosPage />}
      {tab === 1 && <AdminProcesosPage />}
      {tab === 2 && <AdminSeguridadPage />}
      {tab === 3 && <AdminSirhPage />}
    </Box>
  );
};
