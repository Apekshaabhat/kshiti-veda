# TRINEXA ESP32 Firmware Setup & Flashing Guide

## 1. Physical Hardware Connection & Verification

| Sensor | ESP32 Pin | Interface | Notes |
| :--- | :--- | :--- | :--- |
| **Capacitive Soil Moisture** | **GPIO 34** | Analog (ADC1_CH6) | 3.3V power. Only use ADC1 pins with Wi-Fi active. |
| **DHT22 (Temp & Humidity)** | **GPIO 4** | Digital I/O | Requires 4.7kΩ pull-up resistor between VCC and DATA. |
| **DS18B20 (Soil Temp)** | **GPIO 5** | OneWire | Requires 4.7kΩ pull-up resistor between VCC and DATA. |
| **Soil pH Sensor (UART)** | **RX: GPIO 16, TX: GPIO 17** | Serial 2 (9600 baud) | Cross-connect: ESP32 RX16 -> Sensor TX, TX17 -> Sensor RX. |
| **BH1750 (Ambient Light)** | **SDA: GPIO 21, SCL: GPIO 22** | I2C | Connect to 3.3V and GND. |

---

## 2. Arduino IDE Setup & Required Libraries

1. **Board Manager:**
   - In Arduino IDE, go to **File > Preferences**
   - Add to *Additional Boards Manager URLs*:
     `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Go to **Tools > Board > Boards Manager**, search for `esp32` by Espressif Systems and install (version >= 2.0.x).
   - Select Board: **ESP32 Dev Module**.

2. **Library Manager (Install via Tools > Manage Libraries):**
   - `DHT sensor library` by Adafruit (and its dependency `Adafruit Unified Sensor`)
   - `DallasTemperature` by Miles Burton
   - `OneWire` by Paul Stoffregen
   - `BH1750` by Christopher Laws

---

## 3. Configuration

1. In folder `firmware/trinexa_esp32/`, copy `config.h.template` to `config.h`:
   ```cmd
   copy config.h.template config.h
   ```
2. Open `config.h` and configure:
   - `WIFI_SSID`: Your Wi-Fi network name (2.4 GHz).
   - `WIFI_PASSWORD`: Your Wi-Fi password.
   - `BACKEND_HOST`: Your laptop's local IPv4 address (e.g., `192.168.1.50`).
     *(Find via `ipconfig` in Windows Command Prompt under Wi-Fi)*.
   - `BACKEND_PORT`: `3001` (Trinexa backend port).

---

## 4. Calibration (Capacitive Moisture Sensor)

- Measure the analog reading when the sensor is completely dry in the air:
  Check the Serial Monitor output for `Raw ADC: XXXX`. Set `SOIL_ADC_DRY` in `config.h`.
- Submerge the sensor up to the white line in a cup of water:
  Note the `Raw ADC: XXXX`. Set `SOIL_ADC_WET` in `config.h`.

---

## 5. Upload & Serial Verification

1. Connect the ESP32 to your PC via USB cable (CP2102 driver installed).
2. Select COM port under **Tools > Port**.
3. Set Upload Speed: `921600` or `115200`.
4. Click **Upload**.
5. Open Serial Monitor at **115200 baud** to verify sensor initialization, Wi-Fi IP, and telemetry transmission.

