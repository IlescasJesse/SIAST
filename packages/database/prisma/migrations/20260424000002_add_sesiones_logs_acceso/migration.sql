-- Tabla de sesiones activas (control de máx. 2 sesiones por usuario)
CREATE TABLE `sesiones` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `jti`          VARCHAR(36)   NOT NULL,           -- UUID único por sesión
  `usuario_id`   INT           NULL,               -- staff
  `empleado_rfc` VARCHAR(13)   NULL,               -- empleado
  `ip_address`   VARCHAR(45)   NULL,
  `user_agent`   VARCHAR(300)  NULL,
  `activa`       BOOLEAN       NOT NULL DEFAULT true,
  `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expires_at`   DATETIME(3)   NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sesiones_jti_key` (`jti`),
  INDEX `sesiones_usuario_id_idx` (`usuario_id`),
  INDEX `sesiones_empleado_rfc_idx` (`empleado_rfc`),
  INDEX `sesiones_activa_idx` (`activa`),
  CONSTRAINT `sesiones_usuario_id_fkey`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `sesiones_empleado_rfc_fkey`
    FOREIGN KEY (`empleado_rfc`) REFERENCES `empleados`(`rfc`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tabla de logs de acceso (intentos exitosos y fallidos)
CREATE TABLE `logs_acceso` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `tipo`         VARCHAR(10)   NOT NULL,           -- "STAFF" | "EMPLEADO"
  `identifier`   VARCHAR(50)   NOT NULL,           -- usuario o RFC usado en el intento
  `resultado`    VARCHAR(30)   NOT NULL,           -- "OK" | "FAIL_PASSWORD" | "FAIL_NOT_FOUND" | "FAIL_INACTIVE"
  `usuario_id`   INT           NULL,               -- solo si existe y login exitoso
  `empleado_rfc` VARCHAR(13)   NULL,
  `ip_address`   VARCHAR(45)   NULL,
  `user_agent`   VARCHAR(300)  NULL,
  `detalle`      VARCHAR(200)  NULL,
  `created_at`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `logs_acceso_created_at_idx` (`created_at`),
  INDEX `logs_acceso_usuario_id_idx` (`usuario_id`),
  INDEX `logs_acceso_resultado_idx` (`resultado`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
