const input = document.getElementById("xrayImage");
const preview = document.getElementById("preview");
const result = document.getElementById("result");
const button = document.getElementById("predictBtn");

// ── X-RAY VALIDATOR ──
function isLikelyXray(imageData, width, height) {
    const data = imageData.data;
    const totalPixels = width * height;
    let grayPixels = 0;
    let darkPixels = 0;
    let totalBrightness = 0;
    let highSatPixels = 0;
    let totalSaturation = 0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Grayscale check
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        if (maxDiff < 40) grayPixels++;

        // Saturation per pixel
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        totalSaturation += saturation;
        // Even slightly colorful pixels count (threshold lowered to 0.15)
        if (saturation > 0.15) highSatPixels++;

        const brightness = (r + g + b) / 3;
        if (brightness < 140) darkPixels++;
        totalBrightness += brightness;
    }

    const grayRatio  = grayPixels    / totalPixels;
    const darkRatio  = darkPixels    / totalPixels;
    const colorRatio = highSatPixels / totalPixels;
    const avgBright  = totalBrightness / totalPixels;
    const avgSat     = totalSaturation / totalPixels;

    // Strict color rejection:
    // - Average saturation must be very low (X-rays: ~0.02–0.06, aurora: ~0.35+)
    // - Less than 15% pixels can have noticeable color
    // - Must be mostly grayscale
    // - Must have dark regions
    const notColorful   = avgSat     < 0.08;   // key gate — aurora fails hard here
    const fewColorPixels= colorRatio < 0.15;
    const mostlyGray    = grayRatio  > 0.55;
    const hasDark       = darkRatio  > 0.20;
    const notWhite      = avgBright  < 220;
    const notBlack      = avgBright  > 8;

    return notColorful && fewColorPixels && mostlyGray && hasDark && notWhite && notBlack;
}

function validateXray(file) {
    return new Promise((resolve) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/bmp"];
        if (!allowedTypes.includes(file.type)) {
            resolve({ valid: false, reason: "⚠ Invalid file type.\nPlease upload a JPEG or PNG chest X-ray image." });
            return;
        }

        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = function () {
            const ratio = img.width / img.height;
            if (ratio > 3.5 || ratio < 0.25) {
                URL.revokeObjectURL(url);
                resolve({ valid: false, reason: "⚠ Image dimensions don't match a chest X-ray.\nPlease upload a valid X-ray image." });
                return;
            }

            const canvas = document.createElement("canvas");
            const scale = Math.min(1, 150 / Math.max(img.width, img.height));
            canvas.width  = Math.floor(img.width  * scale);
            canvas.height = Math.floor(img.height * scale);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);

            if (isLikelyXray(imageData, canvas.width, canvas.height)) {
                resolve({ valid: true });
            } else {
                resolve({
                    valid: false,
                    reason: "⚠ This doesn't look like a chest X-ray.\nPlease upload a valid grayscale chest X-ray image."
                });
            }
        };

        img.onerror = function () {
            URL.revokeObjectURL(url);
            resolve({ valid: false, reason: "⚠ Could not read the image. Please try a different file." });
        };

        img.src = url;
    });
}

// ── IMAGE PREVIEW — validate on select, block preview if invalid ──
if (input) {
    input.addEventListener("change", async function () {
        const file = input.files[0];
        if (!file) return;

        // Show checking state
        result.style.color = "orange";
        result.innerText = "Checking image...";
        preview.style.display = "none";

        const check = await validateXray(file);

        if (!check.valid) {
            // Reject immediately on file select — don't even show the preview
            result.style.color = "red";
            result.innerText = check.reason;
            input.value = "";          // clear file input
            preview.style.display = "none";
            return;
        }

        // Valid — show preview and clear message
        result.style.color = "";
        result.innerText = "Prediction will appear here";
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = "block";
        };
        reader.readAsDataURL(file);
    });
}

// ── UPLOAD & PREDICT ──
async function uploadData() {
    const name = document.getElementById("patientName").value.trim();
    const age  = document.getElementById("age").value.trim();
    const file = input.files[0];

    if (!name || !age || !file) {
        alert("Please fill all fields and upload an image.");
        return;
    }

    // Double-check validation before sending (in case someone bypassed)
    button.disabled = true;
    result.style.color = "orange";
    result.innerText = "Validating image...";

    const check = await validateXray(file);
    if (!check.valid) {
        result.style.color = "red";
        result.innerText = check.reason;
        button.disabled = false;
        input.value = "";
        preview.style.display = "none";
        return;
    }

    result.style.color = "black";
    result.innerText = "Analyzing... Please wait (this may take up to 2 minutes)";

    const formData = new FormData();
    formData.append("file", file);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    try {
        const response = await fetch("/predict", {
            method: "POST",
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeout);
        const data = await response.json();

        if (data.result === "PNEUMONIA") {
            result.style.color = "red";
            result.innerText = "Patient: " + name + " (Age: " + age + ")\nResult: PNEUMONIA\nConfidence: " + data.confidence + "%";
        } else if (data.result === "NORMAL") {
            result.style.color = "green";
            result.innerText = "Patient: " + name + " (Age: " + age + ")\nResult: NORMAL\nConfidence: " + data.confidence + "%";
        } else {
            result.style.color = "red";
            result.innerText = "Error: " + (data.error || "Unexpected response");
        }

    } catch (error) {
        clearTimeout(timeout);
        result.style.color = "red";
        if (error.name === "AbortError") {
            result.innerText = "Request timed out. Please try again.";
        } else {
            result.innerText = "Server connection error!";
        }
    }

    button.disabled = false;
}