import tensorflow as tf
import h5py
import json

MODEL_PATH = "model/pneumonia_cnn_model.h5"

# Open model file
with h5py.File(MODEL_PATH, "r") as f:
    model_config = f.attrs.get("model_config")

    # Convert config properly
    if isinstance(model_config, bytes):
        model_config = model_config.decode("utf-8")

    model_config = json.loads(model_config)

    # Remove problematic arguments
    for layer in model_config["config"]["layers"]:
        if "config" in layer:
            layer["config"].pop("batch_shape", None)
            layer["config"].pop("optional", None)

    # Rebuild model
    new_model = tf.keras.models.model_from_json(json.dumps(model_config))

# Save fixed model
new_model.save("model/fixed_model.h5")

print(" Model fixed and saved as fixed_model.h5")