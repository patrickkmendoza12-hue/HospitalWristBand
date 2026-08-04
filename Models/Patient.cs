using System.Text.Json.Serialization;

namespace WristbandAdmissionApp.Models
{
    public class Patient
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("age")]
        public string Age { get; set; } = string.Empty;

        [JsonPropertyName("gender")]
        public string Gender { get; set; } = string.Empty;

        [JsonPropertyName("bloodGroup")]
        public string BloodGroup { get; set; } = string.Empty;

        [JsonPropertyName("ward")]
        public string Ward { get; set; } = string.Empty;

        [JsonPropertyName("bedNo")]
        public string BedNo { get; set; } = string.Empty;

        [JsonPropertyName("doctor")]
        public string Doctor { get; set; } = string.Empty;

        [JsonPropertyName("alerts")]
        public object? Alerts { get; set; } // Could be a string or a list of strings

        [JsonPropertyName("admittedAt")]
        public string AdmittedAt { get; set; } = string.Empty;

        [JsonPropertyName("printStatus")]
        public string PrintStatus { get; set; } = string.Empty;
    }
}
