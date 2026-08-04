using System.Net.Sockets;
using System.Text;
using WristbandAdmissionApp.Models;

namespace WristbandAdmissionApp.Services
{
    public interface IPrinterService
    {
        Task SendToPrinterAsync(PrintPayload payload);
    }

    public class PrinterService : IPrinterService
    {
        private readonly ILogger<PrinterService> _logger;

        public PrinterService(ILogger<PrinterService> logger)
        {
            _logger = logger;
        }

        public async Task SendToPrinterAsync(PrintPayload payload)
        {
            if (string.IsNullOrWhiteSpace(payload.PrinterIp) || string.IsNullOrWhiteSpace(payload.RawCode))
            {
                throw new ArgumentException("Printer IP and Raw Code are required.");
            }

            var parts = payload.PrinterIp.Split(':');
            string host = parts[0];
            int port = parts.Length > 1 && int.TryParse(parts[1], out int parsedPort) ? parsedPort : 9100;

            _logger.LogInformation($"[PRINTER SOCKET] Connecting to Thermal Printer at {host}:{port}...");

            using var client = new TcpClient();
            await client.ConnectAsync(host, port);

            _logger.LogInformation("[PRINTER SOCKET] Connected! Sending ZPL raw commands...");

            using var stream = client.GetStream();
            byte[] data = Encoding.UTF8.GetBytes(payload.RawCode);
            await stream.WriteAsync(data, 0, data.Length);

            _logger.LogInformation("[PRINTER SOCKET] Print payload transmitted successfully.");
        }
    }
}
