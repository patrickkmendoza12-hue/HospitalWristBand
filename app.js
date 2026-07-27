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
      age: 42,
      gender: 'Female',
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
    paperWidth: 4.5,  // inches
    paperHeight: 1.0  // inches
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
  }

  function saveSettings() {
    settings.autoPrint = autoPrintToggle.checked;
    settings.connectionMode = printerTypeSelect.value;
    settings.printerIp = printerIpInput.value;
    settings.commandLang = commandLangSelect.value;
    settings.paperWidth = parseFloat(paperWidthInput.value) || 4.5;
    settings.paperHeight = parseFloat(paperHeightInput.value) || 1.0;
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
    const w = settings.paperWidth || 4.5;
    const h = settings.paperHeight || 1.0;
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
    standard: { w: 4.5, h: 1.0, label: 'Standard Wristband' },
    slim: { w: 4.0, h: 0.75, label: 'Slim Wristband' },
    wide: { w: 6.0, h: 1.25, label: 'Wide Wristband' },
    label_2x1: { w: 2.0, h: 1.0, label: '2" × 1" Label' },
    label_3x1: { w: 3.0, h: 1.0, label: '3" × 1" Label' },
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
    widthIn = Math.max(1, Math.min(12, widthIn));
    heightIn = Math.max(0.5, Math.min(6, heightIn));

    // Scaling ratios relative to the defaults (4.5" × 1")
    const DEFAULT_W = 4.5;
    const DEFAULT_H = 1.0;
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

    // Printable area height
    const printArea = document.getElementById('wristbandPrintArea');
    if (printArea) {
      const printAreaH = Math.round((DEFAULT_PX_H - 16) * scaleH);
      printArea.style.height = printAreaH + 'px';
    }

    // --- Scale wb-body height ---
    const wbBody = printArea ? printArea.querySelector('.wb-body') : null;
    if (wbBody) {
      const newBodyH = Math.round(66 * scaleH);
      wbBody.style.height = Math.max(30, newBodyH) + 'px';
    }

    // --- Scale text proportionally ---
    // Patient name: base 0.82rem, scale with height
    const nameEl = document.querySelector('#wristbandPrintArea .wb-patient-name');
    if (nameEl) {
      const nameFontRem = Math.max(0.5, 0.82 * scaleH);
      nameEl.style.fontSize = nameFontRem.toFixed(3) + 'rem';
    }

    // Meta lines (patient meta, admission meta): base 0.58rem
    document.querySelectorAll('#wristbandPrintArea .wb-patient-meta, #wristbandPrintArea .wb-admission-meta').forEach(el => {
      const metaFontRem = Math.max(0.38, 0.58 * scaleH);
      el.style.fontSize = metaFontRem.toFixed(3) + 'rem';
    });

    // Header: base 0.58rem
    const headerEl = document.querySelector('#wristbandPrintArea .wb-header');
    if (headerEl) {
      const headerFontRem = Math.max(0.38, 0.58 * scaleH);
      headerEl.style.fontSize = headerFontRem.toFixed(3) + 'rem';
    }

    // Alert tags: base 0.48rem
    document.querySelectorAll('#wristbandPrintArea .wb-alert-tag').forEach(el => {
      const tagFontRem = Math.max(0.3, 0.48 * scaleH);
      el.style.fontSize = tagFontRem.toFixed(3) + 'rem';
    });

    // --- Scale barcode & QR ---
    // Barcode default: height 44px, width 95px
    const newBarcodeH = Math.max(20, Math.round(44 * scaleH));
    const newBarcodeW = Math.max(50, Math.round(95 * scaleW));
    const barcodeWrapper = document.querySelector('#wristbandPrintArea .barcode-wrapper svg');
    if (barcodeWrapper) {
      barcodeWrapper.style.height = newBarcodeH + 'px';
      barcodeWrapper.style.width = newBarcodeW + 'px';
    }

    // QR default: 40px
    const newQrSize = Math.max(20, Math.round(40 * Math.min(scaleH, scaleW)));
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
    const pageW = widthIn.toFixed(3) + 'in';
    const pageH = heightIn.toFixed(3) + 'in';

    // Print font scales (based on 0.5rem reference at 1" height)
    const printNameFont = Math.max(0.4, 0.72 * scaleH).toFixed(3) + 'rem';
    const printMetaFont = Math.max(0.3, 0.5 * scaleH).toFixed(3) + 'rem';
    const printHeaderFont = Math.max(0.3, 0.52 * scaleH).toFixed(3) + 'rem';
    const printAlertFont = Math.max(0.25, 0.42 * scaleH).toFixed(3) + 'rem';
    const printBarcodeH = Math.max(18, Math.round(38 * scaleH)) + 'px';
    const printBarcodeW = Math.max(50, Math.round(88 * scaleW)) + 'px';
    const printQrSize = Math.max(18, Math.round(36 * Math.min(scaleH, scaleW))) + 'px';
    const printStrapW = (widthIn * 0.978).toFixed(3) + 'in';
    const printStrapH = (heightIn * 0.96).toFixed(3) + 'in';
    const printBodyFont = Math.max(0.4, 0.6 * scaleH).toFixed(3) + 'rem';
    const printMaxNameW = Math.max(1, widthIn * 0.4).toFixed(2) + 'in';

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
    const chipText = `${widthIn}" × ${heightIn}" — ${presetLabel}`;
    if (paperSizeChipLabel) paperSizeChipLabel.textContent = chipText;
    if (previewSizeLabel) previewSizeLabel.textContent = `${widthIn}" × ${heightIn}"`;
  }

  // --- Render Wristband Preview ---
  function renderWristbandPreview(patient) {
    currentSelectedPatient = patient;

    wbName.textContent = patient.name.toUpperCase();
    wbAge.textContent = patient.age;
    wbGender.textContent = patient.gender;
    wbBlood.textContent = patient.bloodGroup;
    wbAdmId.textContent = patient.id;
    wbWard.textContent = patient.ward;
    wbBed.textContent = patient.bedNo || 'N/A';
    wbDate.textContent = patient.admittedAt;

    // Render Alert Tags
    wbAlerts.innerHTML = '';
    if (patient.alerts && patient.alerts.length > 0) {
      patient.alerts.forEach(alert => {
        const tag = document.createElement('span');
        let colorClass = 'alert-blue';
        if (alert.includes('ALLERGY')) colorClass = 'alert-red';
        if (alert.includes('FALL')) colorClass = 'alert-yellow';
        if (alert.includes('DIABETIC')) colorClass = 'alert-purple';
        tag.className = `wb-alert-tag ${colorClass}`;
        tag.textContent = alert;
        wbAlerts.appendChild(tag);
      });
    }

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

    // Render QR Code (Contains Patient Verification Link / JSON Payload)
    try {
      const qrData = JSON.stringify({
        admId: patient.id,
        name: patient.name,
        dob_age: patient.age,
        blood: patient.bloodGroup,
        alerts: patient.alerts
      });

      const canvas = document.getElementById('qrCanvas');
      QRCode.toCanvas(canvas, qrData, {
        width: 52,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (e) {
      console.warn('QR Code error:', e);
    }

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
            <span class="wb-hospital-name"><i class="fa-solid fa-hospital"></i> SILANG SPECIALISTS MEDICAL CENTER</span>
            <span class="wb-date">${patient.admittedAt}</span>
          </div>

          <div class="wb-body">
            <div class="wb-info-block">
              <div class="wb-patient-name">${patient.name.toUpperCase()}</div>
              <div class="wb-patient-meta">
                <span><strong>Age:</strong> ${patient.age} Yrs</span>
                <span><strong>Gender:</strong> ${patient.gender}</span>
                <span><strong>Blood:</strong> ${patient.bloodGroup}</span>
              </div>
              <div class="wb-admission-meta">
                <span><strong>ADM ID:</strong> ${patient.id}</span>
                <span><strong>Ward:</strong> ${patient.ward}</span>
                <span><strong>Bed:</strong> ${patient.bedNo || 'N/A'}</span>
              </div>
              <div class="wb-alerts-bar">
                ${alertsHTML}
              </div>
            </div>

            <div class="wb-codes-block">
              <div class="barcode-wrapper">
                <svg id="printBarcode"></svg>
              </div>
              <div class="qr-wrapper">
                <canvas id="printQrCanvas"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Extra Hole Strap -->
        <div class="wristband-tail">
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

    try {
      const qrData = JSON.stringify({
        admId: patient.id,
        name: patient.name,
        dob_age: patient.age,
        blood: patient.bloodGroup,
        alerts: patient.alerts
      });

      const canvas = document.getElementById('printQrCanvas');
      QRCode.toCanvas(canvas, qrData, {
        width: 36,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });
    } catch (e) {
      console.warn('Print QR Code error:', e);
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
  applyPaperSize(settings.paperWidth || 4.5, settings.paperHeight || 1.0);
});
