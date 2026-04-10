-- Migration: add_otp_tokens
-- Tabla para códigos OTP de autenticación de empleados vía WhatsApp/SMS

CREATE TABLE `otp_tokens` (
    `id`        INT           NOT NULL AUTO_INCREMENT,
    `rfc`       VARCHAR(13)   NOT NULL,
    `codigo`    VARCHAR(6)    NOT NULL,
    `usado`     BOOLEAN       NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3)   NOT NULL,
    `createdAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `otp_tokens_rfc_idx` (`rfc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
