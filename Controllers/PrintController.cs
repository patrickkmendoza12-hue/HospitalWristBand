using Microsoft.AspNetCore.Mvc;
using WristbandAdmissionApp.Models;
using WristbandAdmissionApp.Services;

namespace WristbandAdmissionApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PrintController : ControllerBase
    {
        private readonly IPrinterService _printerService;

        public PrintController(IPrinterService printerService)
        {
            _printerService = printerService;
        }

        [HttpPost("/api/print-wristband")]
        public async Task<IActionResult> PrintWristband([FromBody] PrintPayload payload)
        {
            if (string.IsNullOrWhiteSpace(payload.PrinterIp) || string.IsNullOrWhiteSpace(payload.RawCode))
            {
                return BadRequest(new { error = "Missing printerIp or rawCode" });
            }

            try
            {
                await _printerService.SendToPrinterAsync(payload);
                return Ok(new { status = "success", message = $"Transmitted to {payload.PrinterIp}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Thermal printer connection failed: {ex.Message}" });
            }
        }
    }
}
