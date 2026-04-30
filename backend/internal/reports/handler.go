package reports

import (
	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) GetReportes(c *fiber.Ctx) error {
	reportes, err := h.repo.GetReporteTareas()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(reportes)
}

func (h *Handler) GetLubricacion(c *fiber.Ctx) error {
	reportes, err := h.repo.GetLubricacionReports()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(reportes)
}
func (h *Handler) GetDiagnostico(c *fiber.Ctx) error {
	reportes, err := h.repo.GetDiagnosticoReports()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(reportes)
}

func (h *Handler) GetEngrase(c *fiber.Ctx) error {
	reportes, err := h.repo.GetEngraseReports()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(reportes)
}

func (h *Handler) GetDetalleAdmon(c *fiber.Ctx) error {
	type Request struct {
		IDs []string `json:"ids"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "cuerpo de solicitud inválido",
		})
	}

	detalles, err := h.repo.GetDetalleTareaAdmon(req.IDs)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(detalles)
}

func (h *Handler) GetPartesExcel(c *fiber.Ctx) error {
	type Request struct {
		TareasAbiertas []string `json:"tareas_abiertas"`
	}

	var req Request
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "cuerpo de solicitud inválido",
		})
	}

	partes, err := h.repo.GetPartesParaExcel(req.TareasAbiertas)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(partes)
}

func (h *Handler) GetResponsables(c *fiber.Ctx) error {
	empleados, err := h.repo.GetResponsables()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(empleados)
}

func (h *Handler) GetTecnicos(c *fiber.Ctx) error {
	empleados, err := h.repo.GetTecnicos()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(empleados)
}
