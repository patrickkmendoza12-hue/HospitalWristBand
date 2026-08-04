using System.Text;
using System.Text.Json;
using WristbandAdmissionApp.Models;

namespace WristbandAdmissionApp.Services
{
    public interface IDatabaseService
    {
        Task SavePatientsAsync(List<Patient> patients);
    }

    public class CsvDatabaseService : IDatabaseService
    {
        private readonly string _filePath;

        public CsvDatabaseService(IWebHostEnvironment env)
        {
            _filePath = Path.Combine(env.ContentRootPath, "patients_database.csv");
        }

        public async Task SavePatientsAsync(List<Patient> patients)
        {
            var headers = new[] { "Admission ID", "Patient Name", "Age", "Gender", "Blood Group", "Ward", "Bed No", "Attending Doctor", "Alerts", "Admitted At", "Print Status" };
            
            var csvContent = new StringBuilder();
            csvContent.AppendLine(string.Join(",", headers));

            foreach (var p in patients)
            {
                string alertsStr = string.Empty;
                if (p.Alerts != null)
                {
                    if (p.Alerts is JsonElement jsonElement)
                    {
                        if (jsonElement.ValueKind == JsonValueKind.Array)
                        {
                            var alertsList = jsonElement.EnumerateArray().Select(e => e.GetString()).Where(s => !string.IsNullOrEmpty(s));
                            alertsStr = string.Join(", ", alertsList);
                        }
                        else
                        {
                            alertsStr = jsonElement.ToString();
                        }
                    }
                    else
                    {
                        alertsStr = p.Alerts.ToString() ?? "";
                    }
                }

                var row = new[]
                {
                    p.Id,
                    p.Name,
                    p.Age,
                    p.Gender,
                    p.BloodGroup,
                    p.Ward,
                    p.BedNo,
                    $"\"{p.Doctor}\"",
                    $"\"{alertsStr}\"",
                    p.AdmittedAt,
                    p.PrintStatus
                };

                csvContent.AppendLine(string.Join(",", row));
            }

            await File.WriteAllTextAsync(_filePath, csvContent.ToString(), Encoding.UTF8);
        }
    }
}
