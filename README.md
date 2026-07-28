# HospitalWristBand - Patient Admission & Thermal Wristband Auto-Print System

**DevSupreme Solutions Inc.** presents a robust web-based solution for hospital patient admission combined with a direct thermal printer TCP relay system. 

This application seamlessly bridges the gap between modern browser-based web applications and legacy thermal printing hardware (Zebra, SATO, TSC) using raw printer command languages.

## 🚀 Key Features

### 📋 Patient Management
- **Fast Admission Form:** Quickly input patient data including Name, Age, Gender, Blood Group, Ward, and Medical Alerts (e.g., Allergies, Fall Risk).
- **Live Database:** Stores active patient records locally in the browser (`localStorage`) and automatically syncs to a CSV file (`patients_database.csv`) via the Node.js backend.
- **Excel Support:** Import and export your patient directory to `.xlsx` format instantly using SheetJS.
- **Live Search & Filter:** Quickly find patients by ID, Name, or Ward.

### 🖨️ Advanced Thermal Printing Integration
- **Live Wristband Preview:** See exactly what the thermal printer will output in real-time, scaled proportionally based on label size settings.
- **Raw Command Generation:** Automatically generates native thermal printer commands:
  - **ZPL II** (Zebra, SATO SZPL)
  - **SBPL** (SATO CL4NX/CL6NX)
  - **TSPL** (TSC Printers)
  - **ESC/POS** (Generic POS/Thermal receipt printers)
- **Direct TCP IP Printing:** The Node.js server relays raw commands directly to your network printer over TCP Port 9100, bypassing clunky Windows/Mac printer drivers.
- **Auto-Print on Admission:** Toggle auto-printing to instantly output a wristband the second a patient is admitted.
- **Dynamic Sizing:** Supports standard wristbands (4.5" × 1"), slim, wide, and custom label sizes.

## 🛠️ Architecture

- **Frontend:** Vanilla HTML, CSS, JavaScript (No heavy frameworks).
  - Uses `JsBarcode` for CODE128 barcode generation.
  - Uses `qrcode` for QR code generation.
  - Responsive, modern Glassmorphism UI with Dark Mode support.
- **Backend (Relay Server):** Node.js `server.js`
  - Serves the frontend static files.
  - Provides a `/api/print-wristband` endpoint to tunnel raw ZPL/TSPL commands to a network printer IP via TCP sockets.
  - Provides a `/api/save-db` endpoint to back up the local database to a CSV file.

## ⚙️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.
- A Network Thermal Printer (e.g., Zebra ZD410) connected to the same LAN (optional, browser print fallback works without it).

### Installation & Execution

1. **Clone the repository / Open the folder:**
   Navigate into the `wristband-admission-app` directory.

2. **Start the Node.js Server:**
   ```bash
   node server.js
   ```
   
3. **Open the Application:**
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## 👨‍💻 Usage Flow

1. Enter the Thermal Printer IP Address (e.g., `192.168.1.150:9100`) in the settings panel.
2. Select your printer's command language (ZPL is standard for Zebra).
3. Fill out the **Patient Admission Form**.
4. Click **Admit & Auto-Print Wristband**.
5. The wristband prints instantly, and the patient appears in the Admitted Patients Directory!