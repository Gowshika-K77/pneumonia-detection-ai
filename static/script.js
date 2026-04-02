const input = document.getElementById("xrayImage");
const preview = document.getElementById("preview");
const result = document.getElementById("result");
const button = document.getElementById("predictBtn");

if (input) {
    input.addEventListener("change", function () {
        const file = input.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = "block";
            };
            reader.readAsDataURL(file);
        }
    });
}

async function uploadData() {
    const name = document.getElementById("patientName").value.trim();
    const age = document.getElementById("age").value.trim();
    const file = input.files[0];

    if (!name || !age || !file) {
        alert("Please fill all fields and upload an image.");
        return;
    }

    button.disabled = true;
    result.style.color = "black";
    result.innerText = "Analyzing... Please wait (this may take up to 2 minutes)";

    const formData = new FormData();
    formData.append("file", file);

    // Set 3 minute timeout
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
            result.innerText = "Request timed out. Server is too slow. Please try again.";
        } else {
            result.innerText = "Server connection error!";
        }
    }

    button.disabled = false;
}