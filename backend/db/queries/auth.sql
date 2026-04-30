-- name: GetUserForLogin :one
-- Consulta optimizada según especificación exacta de campos
SELECT 
    f_email_contacto, 
    f_nit_empl, 
    f_desc_cargo,
    MAX(f_ndc) as f_ndc,
    MAX(f_parametro) as f_parametro
FROM SE_W0550
WHERE LTRIM(RTRIM(f_email_contacto)) = @p1 
  AND LTRIM(RTRIM(f_nit_empl)) = @p2
  AND LTRIM(RTRIM(f_desc_cargo)) = 'PROFESIONAL DE PLANEACION Y PROGRAMACION'
GROUP BY 
    f_email_contacto, 
    f_nit_empl, 
    f_desc_cargo;

-- name: GetUserInfo :one
-- Obtener información básica del perfil por email
SELECT 
    f_nombre_empl,
    f_desc_cargo
FROM SE_W0550
WHERE LTRIM(RTRIM(f_email_contacto)) = @p1;
