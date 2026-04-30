-- Migración inicial: Esquema de la tabla SE_W0550
CREATE TABLE SE_W0550 (
    f_email_contacto NVARCHAR(255) NOT NULL,
    f_nit_empl NVARCHAR(100) NOT NULL,
    f_desc_cargo NVARCHAR(255) NOT NULL,
    f_ndc INT,
    f_parametro INT
);
