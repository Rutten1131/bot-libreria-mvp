-- DATOS OFICIALES La Reforma — Su Empresa Amiga (Loja, Ecuador)
-- Basado en información corporativa, puntos de atención y catálogo.
SET NAMES utf8mb4;

DELETE FROM bot_sucursales;
DELETE FROM bot_promociones;
DELETE FROM bot_faqs;
DELETE FROM bot_config;

-- ---------- SUCURSALES (3 puntos de atención oficiales en Loja) ----------
INSERT INTO bot_sucursales (empresa, nombre, direccion, ciudad, telefono, horario) VALUES
('santiago','La Reforma — Matriz','Av. 18 de Noviembre entre Mercadillo y Lourdes','Loja','+593 96 944 4795','{"lun-sab":"08:30-19:30","dom":null}'),
('santiago','La Reforma — Sucursal Zona Militar','Av. 8 de Diciembre y Guayaquil','Loja','+593 96 944 4795','{"lun-vie":"08:30-19:30","sab":"08:30-13:30","dom":null}'),
('santiago','La Reforma — Sucursal Consacola','Av. Pablo Palacio, frente al Redondel del Libro','Loja','+593 96 944 4795','{"lun-vie":"08:30-19:30","sab":"08:30-13:30","dom":null}');

-- ---------- PROMOCIONES VIGENTES ----------
INSERT INTO bot_promociones (empresa, titulo, descripcion, desde, hasta) VALUES
('santiago','Descuento Institucional y Escolar','Precios preferenciales y armado de kits escolares a medida para colegios, escuelas e instituciones.','2026-01-01','2026-12-31'),
('santiago','Compras Mayoristas','Precios especiales al por mayor para papelerías y negocios de Loja y provincias vecinas.','2026-01-01','2026-12-31'),
('santiago','Pago sin recargo','Aceptamos efectivo, transferencias bancarias y tarjetas de crédito o débito sin recargo en tienda física.','2026-01-01','2026-12-31');

-- ---------- FAQS ----------
INSERT INTO bot_faqs (empresa, tema, pregunta, respuesta) VALUES
('santiago','identidad','¿Qué es La Reforma?','La Reforma es una empresa comercial con más de 45 años de historia (fundada en 1979 en Loja) conocida bajo el lema «Su Empresa Amiga». Ofrece soluciones integrales en papelería, útiles escolares, oficina, arte, materiales de imprenta y bazar.'),
('santiago','sucursales','¿Dónde están ubicadas las sucursales de La Reforma?','Contamos con 3 puntos en Loja: 1) Matriz: Av. 18 de Noviembre entre Mercadillo y Lourdes. 2) Sucursal Zona Militar: Av. 8 de Diciembre y Guayaquil. 3) Sucursal Consacola: Av. Pablo Palacio frente al Redondel del Libro.'),
('santiago','horario','¿Cuál es el horario de atención?','Matriz atiende de lunes a sábado de 08:30 a 19:30. Las sucursales Zona Militar y Consacola atienden de lunes a viernes de 08:30 a 19:30 y sábados de 08:30 a 13:30.'),
('santiago','pagos','¿Qué formas de pago aceptan?','Aceptamos efectivo en tiendas físicas, tarjetas de crédito/débito y transferencias bancarias o depósitos para pedidos a distancia y proformas aprobadas.'),
('santiago','factura','¿Emiten factura con RUC?','Sí, emitimos facturas electrónicas autorizadas por el SRI (LUZUCAM S.A.S. - RUC 1191797444001). Procesamos retenciones para clientes corporativos.'),
('santiago','domicilio','¿Hacen entregas o envíos?','Sí, coordinamos entregas y despachos tanto en Loja como a nivel interprovincial a través de nuestra bodega y WhatsApp oficial: +593 96 944 4795.'),
('santiago','retiro','¿Puedo retirar en cualquier sucursal?','Sí, puede coordinar el retiro de su cotización o compra en la sucursal que más le convenga: Matriz, Zona Militar o Consacola.'),
('santiago','mayorista','¿Venden al por mayor o para colegios?','Sí, contamos con un equipo especializado para atención mayorista a instituciones educativas, empresas y papelerías. Armamos kits escolares a medida por presupuesto.'),
('santiago','catalogo','¿Dónde veo el catálogo completo?','Puede consultar nuestro catálogo y tienda online en lareforma.ec/shop o consultarnos directamente por este chat.'),
('santiago','contacto','¿Cuál es su número de WhatsApp oficial?','Nuestro WhatsApp oficial de atención es +593 96 944 4795.'),
('santiago','tiendaonline','¿Tienen página web?','Sí, visite nuestro sitio web oficial en lareforma.ec.');

-- ---------- CONFIG ----------
INSERT INTO bot_config (clave, valor) VALUES
('horario_asesores','{"zona":"America/Guayaquil","lun-sab":["08:30","19:30"],"dom":null}'),
('mensaje_fuera_horario','"Nuestros asesores atienden de lunes a sábado de 08:30 a 19:30. Le responderemos al inicio de la próxima jornada laboral."');
