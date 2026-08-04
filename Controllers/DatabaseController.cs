using Microsoft.AspNetCore.Mvc;
using WristbandAdmissionApp.Models;
using WristbandAdmissionApp.Services;

namespace WristbandAdmissionApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DatabaseController : ControllerBase
    {
        private readonly IDatabaseService _databaseService;
        private readonly ILogger<DatabaseController> _logger;

        public DatabaseController(IDatabaseService databaseService, ILogger<DatabaseController> logger)
        {
            _databaseService = databaseService;
            _logger = logger;
        }

        [HttpPost("/api/save-db")]
        public async Task<IActionResult> SaveDb([FromBody] List<Patient> patients)
        {
            if (patients == null)
            {
                return BadRequest(new { error = "Expected an array of patients" });
            }

            try
            {
                await _databaseService.SavePatientsAsync(patients);
                _logger.LogInformation("[DB] Auto-saved patients_database.csv successfully.");
                return Ok(new { status = "success" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[DB ERROR] Failed to save database:");
                return StatusCode(500, new { error = "Failed to save database" });
            }
        }
    }
}
