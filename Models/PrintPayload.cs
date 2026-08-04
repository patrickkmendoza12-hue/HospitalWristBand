using System.Text.Json.Serialization;

namespace WristbandAdmissionApp.Models
{
    public class PrintPayload
    {
        [JsonPropertyName("printerIp")]
        public string PrinterIp { get; set; } = string.Empty;

        [JsonPropertyName("rawCode")]
        public string RawCode { get; set; } = string.Empty;
    }
}
