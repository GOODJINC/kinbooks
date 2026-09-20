package api

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/kinbooks/kinbooks/internal/mcp"
	"github.com/labstack/echo/v4"
)

type MCPHandler struct {
	mcpServer *mcp.Server
}

func NewMCPHandler(server *mcp.Server) *MCPHandler {
	return &MCPHandler{mcpServer: server}
}

// HandleMCP processes JSON-RPC 2.0 over HTTP POST
func (h *MCPHandler) HandleMCP(c echo.Context) error {
	userID := c.Get("user_id").(string)

	bodyBytes, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"jsonrpc": "2.0",
			"error": map[string]interface{}{
				"code":    -32700,
				"message": "Parse error",
			},
		})
	}

	var req mcp.Request
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"jsonrpc": "2.0",
			"error": map[string]interface{}{
				"code":    -32700,
				"message": "Parse error: Invalid JSON-RPC 2.0",
			},
		})
	}

	res := h.mcpServer.HandleRPC(userID, &req)
	if res == nil {
		return c.NoContent(http.StatusNoContent)
	}

	return c.JSON(http.StatusOK, res)
}
