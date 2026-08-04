/**
 * DevSupreme Solutions Inc. - Patient Admission & Thermal Wristband Auto-Print System
 * Full Client Logic, DB Storage, ZPL/TSPL Generator & Auto-Print Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Initial State & Database ---
  const STORAGE_KEY = 'devsupreme_patients_db';
  const SETTINGS_KEY = 'devsupreme_settings';

  let patientsDB = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [
    {
      id: 'ADM-2026-0041',
      name: 'John Patrick Mendoza',
      age: 21,
      gender: 'Male',
      bloodGroup: 'O+',
      ward: 'Emergency (ER)',
      bedNo: 'B-104',
      doctor: 'Dr. Harvey Flores, MD',
      alerts: ['PENICILLIN ALLERGY', 'FALL RISK'],
      admittedAt: '2026-07-21 14:30',
      printStatus: 'PRINTED'
    },
    {
      id: 'ADM-2026-0042',
      name: 'Klein Silvan',
      age: 58,
      gender: 'Male',
      bloodGroup: 'A+',
      ward: 'ICU (Intensive Care)',
      bedNo: 'ICU-03',
      doctor: 'Dr. Eric Rafer, MD',
      alerts: ['DIABETIC'],
      admittedAt: '2026-07-21 14:50',
      printStatus: 'PENDING'
    }
  ];

  let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {
    autoPrint: true,
    connectionMode: 'browser', // browser, network, bluetooth, qz
    printerIp: '192.168.1.150:9100',
    commandLang: 'zpl',
    paperWidth: 20,  // cm
    paperHeight: 3.0  // cm
  };

  let currentSelectedPatient = patientsDB[0];

  // --- Element Selectors ---
  const admissionForm = document.getElementById('admissionForm');
  const patientsTableBody = document.getElementById('patientsTableBody');
  const autoPrintToggle = document.getElementById('autoPrintToggle');
  const autoPrintIndicator = document.getElementById('autoPrintIndicator');
  const printerTypeSelect = document.getElementById('printerType');
  const printerIpInput = document.getElementById('printerIp');
  const commandLangSelect = document.getElementById('commandLanguage');
  const testPrintBtn = document.getElementById('testPrintBtn');
  const manualPrintWristbandBtn = document.getElementById('manualPrintWristbandBtn');
  const viewRawZplBtn = document.getElementById('viewRawZplBtn');
  const zplDrawer = document.getElementById('zplDrawer');
  const closeZplBtn = document.getElementById('closeZplBtn');
  const rawCodeOutput = document.getElementById('rawCodeOutput');
  const codeLangName = document.getElementById('codeLangName');
  const searchInput = document.getElementById('searchInput');
  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // --- Excel Database Elements ---
  const importExcelBtn = document.getElementById('importExcelBtn');
  const exportExcelBtn = document.getElementById('exportExcelBtn');
  const importExcelInput = document.getElementById('importExcelInput');

  // --- Paper Size Selectors ---
  const paperSizePreset = document.getElementById('paperSizePreset');
  const paperWidthInput = document.getElementById('paperWidth');
  const paperHeightInput = document.getElementById('paperHeight');
  const paperSizeChipLabel = document.getElementById('paperSizeChipLabel');
  const previewSizeLabel = document.getElementById('previewSizeLabel');
  const paperSizeInputsRow = document.getElementById('paperSizeInputs');

  // --- Wristband Preview Selectors ---
  const wbName = document.getElementById('wbName');
  const wbAge = document.getElementById('wbAge');
  const wbGender = document.getElementById('wbGender');
  const wbBlood = document.getElementById('wbBlood');
  const wbAdmId = document.getElementById('wbAdmId');
  const wbWard = document.getElementById('wbWard');
  const wbBed = document.getElementById('wbBed');
  const wbDate = document.getElementById('wbDate');
  const wbAlerts = document.getElementById('wbAlerts');

  // --- Save DB & Settings ---
  function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patientsDB));
    renderPatientsTable();

    // Auto-save to local CSV file via server
    fetch('http://localhost:3000/api/save-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientsDB)
    }).catch(e => console.warn('Auto-save to CSV failed. Ensure server is running.', e));
  }

  function saveSettings() {
    settings.autoPrint = autoPrintToggle.checked;
    settings.connectionMode = printerTypeSelect.value;
    settings.printerIp = printerIpInput.value;
    settings.commandLang = commandLangSelect.value;
    settings.paperWidth = parseFloat(paperWidthInput.value) || 20;
    settings.paperHeight = parseFloat(paperHeightInput.value) || 3.0;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    updateSettingsUI();
    applyPaperSize(settings.paperWidth, settings.paperHeight);
  }

  function updateSettingsUI() {
    autoPrintToggle.checked = settings.autoPrint;
    printerTypeSelect.value = settings.connectionMode;
    printerIpInput.value = settings.printerIp;
    commandLangSelect.value = settings.commandLang;

    // Sync paper size inputs
    const w = settings.paperWidth || 20;
    const h = settings.paperHeight || 3.0;
    paperWidthInput.value = w;
    paperHeightInput.value = h;

    // Sync preset dropdown
    const matchedPreset = getPresetKeyForSize(w, h);
    paperSizePreset.value = matchedPreset;
    paperSizeInputsRow.style.display = matchedPreset === 'custom' ? 'flex' : 'flex';

    if (settings.autoPrint) {
      autoPrintIndicator.style.display = 'flex';
    } else {
      autoPrintIndicator.style.display = 'none';
    }
  }

  // --- Paper Size Preset Definitions ---
  const PAPER_PRESETS = {
    sato_eco_nano: { w: 20.01, h: 3.0, label: 'SATO Eco Nano (200.1x30mm)' },
    standard: { w: 20.1, h: 3.0, label: 'Standard Wristband' },
    slim: { w: 10.0, h: 2.0, label: 'Slim Wristband' },
    wide: { w: 15.0, h: 3.5, label: 'Wide Wristband' },
    label_2x1: { w: 5.0, h: 2.5, label: 'Label — 5cm × 2.5cm' },
    label_3x1: { w: 7.5, h: 2.5, label: 'Label — 7.5cm × 2.5cm' },
    custom: { w: null, h: null, label: 'Custom Size' }
  };

  function getPresetKeyForSize(w, h) {
    for (const [key, preset] of Object.entries(PAPER_PRESETS)) {
      if (preset.w === w && preset.h === h) return key;
    }
    return 'custom';
  }

  // --- Apply Paper Size to Preview + Print ---
  function applyPaperSize(widthIn, heightIn) {
    // --- Clamp values to sane ranges ---
    widthIn = Math.max(1, Math.min(50, widthIn));
    heightIn = Math.max(0.5, Math.min(50, heightIn));

    // Scaling ratios relative to the defaults (20.01cm × 3cm)
    const DEFAULT_W = 20.01;
    const DEFAULT_H = 3.0;
    const scaleW = widthIn / DEFAULT_W;
    const scaleH = heightIn / DEFAULT_H;

    // --- Screen preview pixel dimensions ---
    // Default on-screen: 780px wide × 110px tall
    const DEFAULT_PX_W = 780;
    const DEFAULT_PX_H = 110;
    const newPxW = Math.round(DEFAULT_PX_W * scaleW);
    const newPxH = Math.round(DEFAULT_PX_H * scaleH);

    // Update wristband strap dimensions
    const strap = document.getElementById('wristbandStrap');
    if (strap) {
      strap.style.width = newPxW + 'px';
      strap.style.height = newPxH + 'px';
    }

    // Printable area mapped to physical constraints
    const printArea = document.getElementById('wristbandPrintArea');
    if (printArea) {
      printArea.style.position = '';
      printArea.style.left = '';
      printArea.style.top = '';
      printArea.style.width = '';
      printArea.style.height = '';
      printArea.style.margin = '';
      printArea.style.padding = '';
      printArea.style.border = '';
      printArea.style.overflow = '';
      
      const printAreaH = Math.round((DEFAULT_PX_H - 16) * scaleH);
      printArea.style.height = printAreaH + 'px';
      
      const wbBody = printArea.querySelector('.wb-body');
      if (wbBody) {
        const newBodyH = Math.round(66 * scaleH);
        wbBody.style.height = Math.max(30, newBodyH) + 'px';
      }
    }

    // --- Scale text proportionally (scaled down for 5.5cm x 2.0cm area) ---
    // Patient name
    const nameEl = document.querySelector('#wristbandPrintArea .wb-patient-name');
    if (nameEl) {
      const nameFontRem = Math.max(0.5, 0.82 * scaleH);
      nameEl.style.fontSize = nameFontRem.toFixed(3) + 'rem';
      nameEl.style.maxWidth = ''; // Remove strict width
    }

    // Meta lines (patient meta, admission meta)
    document.querySelectorAll('#wristbandPrintArea .wb-patient-meta, #wristbandPrintArea .wb-admission-meta').forEach(el => {
      const metaFontRem = Math.max(0.38, 0.58 * scaleH);
      el.style.fontSize = metaFontRem.toFixed(3) + 'rem';
    });

    // Header
    const headerEl = document.querySelector('#wristbandPrintArea .wb-header');
    if (headerEl) {
      const headerFontRem = Math.max(0.38, 0.58 * scaleH);
      headerEl.style.fontSize = headerFontRem.toFixed(3) + 'rem';
    }

    // Alert tags
    document.querySelectorAll('#wristbandPrintArea .wb-alert-tag').forEach(el => {
      const tagFontRem = Math.max(0.25, 0.38 * scaleH);
      el.style.fontSize = tagFontRem.toFixed(3) + 'rem';
    });

    // --- Scale barcode & QR ---
    // Barcode: make it larger as requested
    const newBarcodeH = Math.max(25, Math.round(36 * scaleH));
    const newBarcodeW = Math.max(60, Math.round(110 * scaleW));
    const barcodeWrapper = document.querySelector('#wristbandPrintArea .barcode-wrapper svg');
    if (barcodeWrapper) {
      barcodeWrapper.style.height = newBarcodeH + 'px';
      barcodeWrapper.style.width = newBarcodeW + 'px';
    }

    // QR size
    const newQrSize = Math.max(20, Math.round(30 * Math.min(scaleH, scaleW)));
    const qrCanvas = document.querySelector('#wristbandPrintArea .qr-wrapper canvas');
    if (qrCanvas) {
      qrCanvas.style.width = newQrSize + 'px';
      qrCanvas.style.height = newQrSize + 'px';
    }

    // Re-render barcode at new dimensions so it fills correctly
    if (currentSelectedPatient) {
      try {
        const barcodeFontSize = Math.max(6, Math.round(10 * scaleH));
        const barcodeLineW = Math.max(0.8, 1.5 * scaleW);
        JsBarcode('#barcodeCanvas', currentSelectedPatient.id, {
          format: 'CODE128',
          lineColor: '#000000',
          width: barcodeLineW,
          height: Math.max(18, Math.round(40 * scaleH)),
          displayValue: true,
          fontSize: barcodeFontSize,
          margin: 2
        });
      } catch (e) { console.warn('Barcode resize error:', e); }

      // Re-render QR at new size
      try {
        const qrData = JSON.stringify({
          admId: currentSelectedPatient.id,
          name: currentSelectedPatient.name,
          dob_age: currentSelectedPatient.age,
          blood: currentSelectedPatient.bloodGroup,
          alerts: currentSelectedPatient.alerts
        });
        const canvas = document.getElementById('qrCanvas');
        QRCode.toCanvas(canvas, qrData, {
          width: Math.max(24, Math.round(52 * Math.min(scaleH, scaleW))),
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });
      } catch (e) { console.warn('QR resize error:', e); }
    }

    // --- Inject dynamic @media print override ---
    const pageW = widthIn.toFixed(3) + 'cm';
    const pageH = heightIn.toFixed(3) + 'cm';

    // Print font scales (restored to normal scales)
    const printNameFont = Math.max(0.4, 0.72 * scaleH).toFixed(3) + 'rem';
    const printMetaFont = Math.max(0.3, 0.5 * scaleH).toFixed(3) + 'rem';
    const printHeaderFont = Math.max(0.3, 0.52 * scaleH).toFixed(3) + 'rem';
    const printAlertFont = Math.max(0.25, 0.42 * scaleH).toFixed(3) + 'rem';
    
    // Matched larger barcode sizes for print
    const printBarcodeH = Math.max(25, Math.round(36 * scaleH)) + 'px';
    const printBarcodeW = Math.max(60, Math.round(110 * scaleW)) + 'px';
    const printQrSize = Math.max(18, Math.round(36 * Math.min(scaleH, scaleW))) + 'px';
    
    const printStrapW = (widthIn * 0.978).toFixed(3) + 'cm';
    const printStrapH = (heightIn * 0.96).toFixed(3) + 'cm';
    const printBodyFont = Math.max(0.4, 0.6 * scaleH).toFixed(3) + 'rem';
    const printMaxNameW = Math.max(1, widthIn * 0.4).toFixed(2) + 'cm';

    let dynStyle = document.getElementById('dynamicPrintStyle');
    if (!dynStyle) {
      dynStyle = document.createElement('style');
      dynStyle.id = 'dynamicPrintStyle';
      document.head.appendChild(dynStyle);
    }

    dynStyle.textContent = `
      @media print {
        @page {
          size: ${pageW} ${pageH};
          margin: 0;
        }
        html, body {
          width: ${pageW} !important;
          height: ${pageH} !important;
          max-height: ${pageH} !important;
        }
        .thermal-print-only {
          width: ${pageW} !important;
          height: ${pageH} !important;
        }
        .thermal-print-only .wristband-strap {
          width: ${printStrapW} !important;
          height: ${printStrapH} !important;
          font-size: ${printBodyFont} !important;
        }
        .thermal-print-only .wb-header {
          font-size: ${printHeaderFont} !important;
        }
        .thermal-print-only .wb-patient-name {
          font-size: ${printNameFont} !important;
          max-width: ${printMaxNameW} !important;
        }
        .thermal-print-only .wb-patient-meta,
        .thermal-print-only .wb-admission-meta {
          font-size: ${printMetaFont} !important;
        }
        .thermal-print-only .wb-alert-tag {
          font-size: ${printAlertFont} !important;
        }
        .thermal-print-only .barcode-wrapper svg {
          width: ${printBarcodeW} !important;
          height: ${printBarcodeH} !important;
        }
        .thermal-print-only .qr-wrapper canvas {
          width: ${printQrSize} !important;
          height: ${printQrSize} !important;
        }
      }
    `;

    // --- Update chip & preview header ---
    const presetKey = getPresetKeyForSize(widthIn, heightIn);
    const presetLabel = (PAPER_PRESETS[presetKey] && PAPER_PRESETS[presetKey].label) || 'Custom Size';
    const chipText = `${widthIn}cm × ${heightIn}cm — ${presetLabel}`;
    if (paperSizeChipLabel) paperSizeChipLabel.textContent = chipText;
    if (previewSizeLabel) previewSizeLabel.textContent = `${widthIn}cm × ${heightIn}cm`;
  }

  // --- Render Wristband Preview ---
  function renderWristbandPreview(patient) {
    currentSelectedPatient = patient;

    if (wbName) wbName.textContent = patient.name.toUpperCase();
    if (wbGender) wbGender.textContent = patient.gender;
    if (wbBlood) wbBlood.textContent = patient.bloodGroup;
    if (wbAdmId) wbAdmId.textContent = patient.id;
    if (wbBed) wbBed.textContent = patient.bedNo || 'N/A';
    if (wbDate) wbDate.textContent = patient.admittedAt;

    // Render Barcode Code128
    try {
      JsBarcode('#barcodeCanvas', patient.id, {
        format: 'CODE128',
        lineColor: '#000000',
        width: 1.5,
        height: 40,
        displayValue: true,
        fontSize: 10,
        margin: 2
      });
    } catch (e) {
      console.warn('Barcode error:', e);
    }

    // Removed QR Code generator as QR wrapper was removed from template
    // Update raw printer command snippet if drawer open
    updateRawPrinterCodeSnippet(patient);
  }

  // --- Thermal Printer Code Generator (1" x 11" Label Size) ---
  function generateSBPLCode(patient) {
    const alertsText = patient.alerts.join(' | ') || 'NO KNOWN ALERTS';
    return `<ESC>A
<ESC>A3H0001V0001
<ESC>V0050<H>0050<P>03<M>SILANG SPECIALISTS MEDICAL CENTER
<ESC>V0050<H>0550<P>02<M>${patient.admittedAt}
<ESC>V0100<H>0050<FW0303><M>NAME: ${patient.name.toUpperCase()}
<ESC>V0220<H>0050<P>03<M>AGE: ${patient.age} Yrs   GENDER: ${patient.gender}   BLOOD: ${patient.bloodGroup}
<ESC>V0280<H>0050<P>03<M>ADM ID: ${patient.id}   WARD: ${patient.ward}   BED: ${patient.bedNo || 'N/A'}
<ESC>V0340<H>0050<P>03<M>PHYSICIAN: ${patient.doctor || 'N/A'}
<ESC>V0400<H>0050<P>03<M>ALERTS: ${alertsText}
<ESC>V0480<H>0100<BG03100${patient.id}
<ESC>V0480<H>0550<2D30>,M,08,1,0<DN>${patient.id.length.toString().padStart(4, '0')},${patient.id}
<ESC>Q1
<ESC>Z`;
  }

  function generateZPLCode(patient) {
    const alertsText = patient.alerts.join(' | ') || 'NO KNOWN ALERTS';
    return `^XA
^PW812
^LL1218
^FO40,40^A0N,32,32^SILANG SPECIALISTS MEDICAL CENTER^FS
^FO520,40^A0N,24,24^FD${patient.admittedAt}^FS
^FO40,85^GB732,3,3^FS
^FO40,110^A0N,52,52^FD${patient.name.toUpperCase()}^FS
^FO40,180^A0N,30,30^FDAge: ${patient.age} Yrs | Gender: ${patient.gender} | Blood: ${patient.bloodGroup}^FS
^FO40,225^A0N,30,30^FDWard: ${patient.ward} | Bed: ${patient.bedNo || 'N/A'}^FS
^FO40,270^A0N,28,28^FDAttending: ${patient.doctor || 'N/A'}^FS
^FO40,315^GB732,60,60,B^FS
^FO50,330^FR^A0N,32,32^FDALERTS: ${alertsText}^FS
^FO40,410^GB732,3,3^FS
^FO80,450^BY3,3,100^BCN,100,Y,N,N^FD${patient.id}^FS
^FO550,450^BQN,2,8^FDMM,A${patient.id}^FS
^XZ`;
  }

  function generateTSPLCode(patient) {
    return `SIZE 4 in, 6 in
GAP 0.12 in, 0
DIRECTION 1
CLS
TEXT 40,40,"4",0,1,1,"SILANG SPECIALISTS MEDICAL CENTER"
TEXT 40,90,"3",0,1,1,"PATIENT: ${patient.name.toUpperCase()}"
TEXT 40,140,"3",0,1,1,"AGE: ${patient.age}  GENDER: ${patient.gender}  BLOOD: ${patient.bloodGroup}"
TEXT 40,190,"3",0,1,1,"ADM ID: ${patient.id}  WARD: ${patient.ward}"
TEXT 40,240,"3",0,1,1,"ALERTS: ${patient.alerts.join(' | ') || 'NONE'}"
BARCODE 80,310,"128",90,1,0,3,3,"${patient.id}"
QRCODE 550,310,H,7,A,0,"${patient.id}"
PRINT 1,1`;
  }

  function generateESCPOSCode(patient) {
    return `\x1B\x40` + // Initialize
      `\x1B\x61\x01` + // Center align
      `SILANG SPECIALISTS MEDICAL CENTER\n` +
      `================================\n` +
      `PATIENT: ${patient.name.toUpperCase()}\n` +
      `AGE: ${patient.age} | GENDER: ${patient.gender} | BLOOD: ${patient.bloodGroup}\n` +
      `ADM ID: ${patient.id} | WARD: ${patient.ward}\n` +
      `PHYSICIAN: ${patient.doctor || 'N/A'}\n` +
      `ALERTS: ${patient.alerts.join(', ') || 'NONE'}\n` +
      `--------------------------------\n` +
      `\x1D\x6b\x49\x0A${patient.id}` + // Barcode
      `\n\n\x1D\x56\x41\x00`; // Cut
  }

  function updateRawPrinterCodeSnippet(patient) {
    const lang = settings.commandLang;
    codeLangName.textContent = lang.toUpperCase();

    if (lang === 'sbpl') {
      rawCodeOutput.textContent = generateSBPLCode(patient);
    } else if (lang === 'zpl') {
      rawCodeOutput.textContent = generateZPLCode(patient);
    } else if (lang === 'tspl') {
      rawCodeOutput.textContent = generateTSPLCode(patient);
    } else {
      rawCodeOutput.textContent = generateESCPOSCode(patient);
    }
  }

  // --- Auto-Print Execution Engine ---
  async function triggerThermalPrint(patient) {
    console.log(`[PRINT ENGINE] Triggering print for ${patient.id} via mode: ${settings.connectionMode}`);

    // Update patient print status
    patient.printStatus = 'PRINTED';
    saveDB();

    if (settings.connectionMode === 'browser') {
      // Direct Browser Silent Print
      renderPrintableContainer(patient);
      window.print();
    } else if (settings.connectionMode === 'network') {
      let rawCode = generateSBPLCode(patient);
      if (settings.commandLang === 'zpl') rawCode = generateZPLCode(patient);
      else if (settings.commandLang === 'tspl') rawCode = generateTSPLCode(patient);
      else if (settings.commandLang === 'escpos') rawCode = generateESCPOSCode(patient);

      const payload = {
        printerIp: settings.printerIp,
        commandLang: settings.commandLang,
        rawCode: rawCode
      };

      try {
        const response = await fetch('http://localhost:3000/api/print-wristband', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          showNotification(`Printed to Thermal Printer at ${settings.printerIp}!`, 'success');
        } else {
          showNotification('Network Print Relay Offline. Reverting to Browser Direct Print...', 'warning');
          renderPrintableContainer(patient);
          window.print();
        }
      } catch (e) {
        showNotification('Print Relay server not detected. Using Browser Print fallback.', 'info');
        renderPrintableContainer(patient);
        window.print();
      }
    } else {
      showNotification(`Raw print payload generated for ${settings.connectionMode.toUpperCase()}!`, 'success');
      renderPrintableContainer(patient);
      window.print();
    }
  }

  function renderPrintableContainer(patient) {
    const printContainer = document.getElementById('printContainer');

    // Build alerts HTML matching preview format
    let alertsHTML = '';
    if (patient.alerts && patient.alerts.length > 0) {
      alertsHTML = patient.alerts.map(alert => {
        let colorClass = 'alert-blue';
        if (alert.includes('ALLERGY')) colorClass = 'alert-red';
        if (alert.includes('FALL')) colorClass = 'alert-yellow';
        if (alert.includes('DIABETIC')) colorClass = 'alert-purple';
        return `<span class="wb-alert-tag ${colorClass}">${alert}</span>`;
      }).join(' ');
    }

    printContainer.innerHTML = `
      <div class="wristband-strap print-strap">
        <!-- Fastener Snap -->
        <div class="wristband-snap" title="Security Snap Fastener">
          <div class="snap-hole"></div>
          <div class="snap-pin"></div>
        </div>

        <!-- Main Printable Zone -->
        <div class="wristband-printable-area">
          <div class="wb-header">
            <span class="wb-hospital-name"><i class="fa-solid fa-hospital"></i> Silang Specialists Medical Center</span>
            <span class="wb-date">${patient.admittedAt}</span>
          </div>

          <div class="wb-body">
            <div class="wb-info-block">
              <div class="wb-patient-name">${patient.name.toUpperCase()}</div>
              <div class="wb-patient-meta">
                <span><strong>Gender:</strong> ${patient.gender}</span>
                <span><strong>Blood:</strong> ${patient.bloodGroup}</span>
                <span><strong>Bed:</strong> ${patient.bedNo || 'N/A'}</span>
              </div>
              <div class="wb-patient-meta">
                <span><strong>ADM ID:</strong> ${patient.id}</span>
              </div>
            </div>

            <div class="wb-codes-block">
              <div class="barcode-wrapper">
                <svg id="printBarcode"></svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Extra Hole Strap -->
        <div class="wristband-tail">
          <div class="tail-hole"></div>
          <div class="tail-hole"></div>
          <div class="tail-hole"></div>
          <div class="tail-hole"></div>
          <div class="tail-hole"></div>
          <div class="tail-hole"></div>
          <div class="tail-hole"></div>
          <div class="tail-hole"></div>
          <div class="tail-hole"></div>
        </div>
      </div>
    `;

    try {
      JsBarcode('#printBarcode', patient.id, {
        format: 'CODE128',
        lineColor: '#000000',
        width: 1.2,
        height: 28,
        displayValue: true,
        fontSize: 8,
        margin: 1
      });
    } catch (e) {
      console.warn('Print barcode error:', e);
    }

  }

  // --- Render Patients Table ---
  function renderPatientsTable(filter = '') {
    patientsTableBody.innerHTML = '';

    const filtered = patientsDB.filter(p =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      p.id.toLowerCase().includes(filter.toLowerCase()) ||
      p.ward.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      patientsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted);">No patient records found.</td></tr>`;
      return;
    }

    filtered.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${p.id}</strong></td>
        <td>${p.name}</td>
        <td>${p.age} / ${p.gender}</td>
        <td><span class="step-badge">${p.bloodGroup}</span></td>
        <td>${p.ward} (${p.bedNo || '-'})</td>
        <td>${p.alerts.map(a => `<span class="wb-alert-tag alert-red">${a}</span>`).join(' ') || '-'}</td>
        <td>
          <span class="status-badge ${p.printStatus === 'PRINTED' ? 'status-printed' : 'status-pending'}">
            <i class="fa-solid ${p.printStatus === 'PRINTED' ? 'fa-check' : 'fa-clock'}"></i> ${p.printStatus}
          </span>
        </td>
        <td>
          <button class="btn btn-outline btn-sm print-row-btn" data-id="${p.id}">
            <i class="fa-solid fa-print"></i> Print
          </button>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (!e.target.closest('.print-row-btn')) {
          renderWristbandPreview(p);
        }
      });

      patientsTableBody.appendChild(tr);
    });

    // Row print button click event
    document.querySelectorAll('.print-row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = btn.dataset.id;
        const patient = patientsDB.find(p => p.id === pid);
        if (patient) {
          renderWristbandPreview(patient);
          triggerThermalPrint(patient);
        }
      });
    });
  }

  // --- Form Submit Event (Patient Admission & Auto-Print) ---
  admissionForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedAlerts = Array.from(document.querySelectorAll('input[name="alert"]:checked')).map(cb => cb.value);

    // Generate unique ADM ID
    const newId = `ADM-2026-${String(patientsDB.length + 41).padStart(4, '0')}`;
    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 16);

    const newPatient = {
      id: newId,
      name: document.getElementById('fullName').value.trim(),
      age: parseInt(document.getElementById('age').value),
      gender: document.getElementById('gender').value,
      bloodGroup: document.getElementById('bloodGroup').value,
      ward: document.getElementById('ward').value,
      bedNo: document.getElementById('bedNo').value.trim() || 'Unassigned',
      doctor: document.getElementById('attendingDoctor').value.trim() || 'Attending Physician',
      alerts: selectedAlerts,
      admittedAt: formattedDate,
      printStatus: 'PENDING'
    };

    patientsDB.unshift(newPatient);
    saveDB();
    renderWristbandPreview(newPatient);

    showNotification(`Patient ${newPatient.name} Admitted!`, 'success');

    // Trigger Auto-Print if Enabled
    if (settings.autoPrint) {
      setTimeout(() => {
        triggerThermalPrint(newPatient);
      }, 300);
    }

    // Reset Form
    admissionForm.reset();
  });

  // --- Settings & UI Handlers ---
  autoPrintToggle.addEventListener('change', saveSettings);
  printerTypeSelect.addEventListener('change', saveSettings);
  printerIpInput.addEventListener('change', saveSettings);
  commandLangSelect.addEventListener('change', () => {
    saveSettings();
    updateRawPrinterCodeSnippet(currentSelectedPatient);
  });

  // --- Paper Size Event Handlers ---
  paperSizePreset.addEventListener('change', () => {
    const key = paperSizePreset.value;
    if (key !== 'custom' && PAPER_PRESETS[key]) {
      paperWidthInput.value = PAPER_PRESETS[key].w;
      paperHeightInput.value = PAPER_PRESETS[key].h;
    }
    // Always show the width/height inputs (even for presets, so user can see exact values)
    paperSizeInputsRow.style.display = 'flex';
    saveSettings();
  });

  paperWidthInput.addEventListener('change', () => {
    // When user manually edits, switch preset to 'custom'
    const w = parseFloat(paperWidthInput.value);
    const h = parseFloat(paperHeightInput.value);
    const match = getPresetKeyForSize(w, h);
    paperSizePreset.value = match;
    saveSettings();
  });

  paperHeightInput.addEventListener('change', () => {
    const w = parseFloat(paperWidthInput.value);
    const h = parseFloat(paperHeightInput.value);
    const match = getPresetKeyForSize(w, h);
    paperSizePreset.value = match;
    saveSettings();
  });

  testPrintBtn.addEventListener('click', () => {
    triggerThermalPrint(currentSelectedPatient);
  });

  manualPrintWristbandBtn.addEventListener('click', () => {
    triggerThermalPrint(currentSelectedPatient);
  });

  viewRawZplBtn.addEventListener('click', () => {
    zplDrawer.style.display = 'block';
    updateRawPrinterCodeSnippet(currentSelectedPatient);
  });

  closeZplBtn.addEventListener('click', () => {
    zplDrawer.style.display = 'none';
  });

  // --- Excel Export & Import Logic ---
  exportExcelBtn.addEventListener('click', () => {
    if (!window.XLSX) {
      if (typeof showNotification === 'function') showNotification('Excel library not loaded yet.', 'warning');
      else alert('Excel library not loaded yet.');
      return;
    }
    // Prepare data for export
    const dataToExport = patientsDB.map(p => ({
      'Admission ID': p.id,
      'Patient Name': p.name,
      'Age': p.age,
      'Gender': p.gender,
      'Blood Group': p.bloodGroup,
      'Ward': p.ward,
      'Bed No': p.bedNo,
      'Attending Doctor': p.doctor,
      'Alerts': Array.isArray(p.alerts) ? p.alerts.join(', ') : p.alerts,
      'Admitted At': p.admittedAt,
      'Print Status': p.printStatus
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Patients DB');
    XLSX.writeFile(workbook, 'patients_database.xlsx');
  });

  importExcelBtn.addEventListener('click', () => {
    importExcelInput.click();
  });

  importExcelInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
      if (typeof showNotification === 'function') showNotification('Excel library not loaded yet.', 'warning');
      else alert('Excel library not loaded yet.');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);

      if (json && json.length > 0) {
        patientsDB = json.map(row => ({
          id: row['Admission ID'] || row.id || '',
          name: row['Patient Name'] || row.name || 'Unknown',
          age: parseInt(row['Age'] || row.age) || 0,
          gender: row['Gender'] || row.gender || 'Other',
          bloodGroup: row['Blood Group'] || row.bloodGroup || '',
          ward: row['Ward'] || row.ward || '',
          bedNo: row['Bed No'] || row.bedNo || '',
          doctor: row['Attending Doctor'] || row.doctor || '',
          alerts: (row['Alerts'] || row.alerts || '').split(',').map(s => s.trim()).filter(Boolean),
          admittedAt: row['Admitted At'] || row.admittedAt || new Date().toISOString().replace('T', ' ').substring(0, 16),
          printStatus: row['Print Status'] || row.printStatus || 'PENDING'
        })).filter(p => p.id); // Must have an ID

        saveDB();
        if (patientsDB.length > 0) {
          renderWristbandPreview(patientsDB[0]);
        }
        if (typeof showNotification === 'function') showNotification(`Database imported successfully from ${file.name}!`, 'success');
        else alert(`Database imported successfully from ${file.name}!`);
      } else {
        if (typeof showNotification === 'function') showNotification('No valid data found in the Excel file.', 'warning');
        else alert('No valid data found in the Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so the same file can be selected again
    e.target.value = '';
  });

  searchInput.addEventListener('input', (e) => {
    renderPatientsTable(e.target.value);
  });

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    themeToggleBtn.querySelector('i').className = next === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  });

  // --- Notification Toast ---
  function showNotification(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      background: #1f8a8e; color: #fff; padding: 0.8rem 1.4rem;
      border-radius: 10px; font-weight: 600; font-size: 0.9rem;
      border: 1px solid rgba(45, 212, 191, 0.4);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(31, 138, 139, 0.4); animation: fadeIn 0.3s;
    `;
    if (type === 'success') toast.style.background = '#0d9488';
    if (type === 'warning') toast.style.background = '#f59e0b';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // --- Initial Render ---
  updateSettingsUI();
  renderPatientsTable();
  renderWristbandPreview(currentSelectedPatient);
  // Apply saved paper size on load
  applyPaperSize(settings.paperWidth || 20, settings.paperHeight || 3.0);
  // --- Live Clock ---
  const clockTimeEl = document.getElementById('liveClockTime');
  const clockDateEl = document.getElementById('liveClockDate');

  function updateClock() {
    const TZ = 'Asia/Manila';
    const now = new Date();

    // Time: HH:MM:SS in Manila time
    const timeStr = new Intl.DateTimeFormat('en-PH', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);
    if (clockTimeEl) clockTimeEl.textContent = timeStr;

    // Date: Mon, Aug 04, 2026 in Manila time
    const dateStr = new Intl.DateTimeFormat('en-PH', {
      timeZone: TZ,
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).format(now);
    if (clockDateEl) clockDateEl.textContent = dateStr;

    // --- Live update the Wristband Preview date/time (Manila time) ---
    const wbDateEl = document.getElementById('wbDate');
    if (wbDateEl) {
      // Format: YYYY-MM-DD HH:MM:SS  (matches the wristband label style)
      const parts = new Intl.DateTimeFormat('en-PH', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(now);

      const get = (type) => parts.find(p => p.type === type)?.value ?? '00';
      const wbTimeStr = `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
      wbDateEl.textContent = wbTimeStr;
    }
  }

  updateClock(); // Run immediately so there's no blank flash on load
  setInterval(updateClock, 1000);
});
