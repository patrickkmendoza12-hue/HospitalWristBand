using Microsoft.Extensions.FileProviders;
using WristbandAdmissionApp.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();

// Configure our specific services
builder.Services.AddScoped<IPrinterService, PrinterService>();
builder.Services.AddScoped<IDatabaseService, CsvDatabaseService>();

// CORS exactly as it was in server.js
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", builder =>
    {
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    // Development specific middleware
}

app.UseCors("AllowAll");
app.UseAuthorization();

// Setup static file serving for our frontend in the root folder
var rootPath = builder.Environment.ContentRootPath;
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(rootPath),
    RequestPath = ""
});

// Setup default mapping to index.html
app.MapGet("/", (HttpContext context) =>
{
    context.Response.Redirect("/index.html");
    return Task.CompletedTask;
});

app.MapControllers();

// We override the default port to match our Node server port 3000
app.Run("http://localhost:3000");
