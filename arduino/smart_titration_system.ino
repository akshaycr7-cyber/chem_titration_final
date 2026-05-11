#include <Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

const int phPin = A0;
const int servoPin = 9;
const int ledPin = 6;
const int buzzerPin = 7;

const float voltageAtPh7 = 2.50;
const float phSlope = -5.70;
const float mlPerServoPulse = 0.05;
const float endpointPh = 7.00;
const float endpointTolerance = 0.12;

Servo buretteServo;
LiquidCrystal_I2C lcd(0x27, 16, 2);

bool running = false;
float volumeMl = 0.0;
unsigned long lastSampleMs = 0;
unsigned long lastDoseMs = 0;

float readPh() {
  long total = 0;
  for (int i = 0; i < 20; i++) {
    total += analogRead(phPin);
    delay(5);
  }

  float raw = total / 20.0;
  float voltage = raw * (5.0 / 1023.0);
  return 7.0 + ((voltage - voltageAtPh7) * phSlope);
}

void dispenseDrop() {
  buretteServo.write(55);
  delay(160);
  buretteServo.write(95);
  volumeMl += mlPerServoPulse;
}

void showStatus(float ph) {
  lcd.setCursor(0, 0);
  lcd.print("pH:");
  lcd.print(ph, 2);
  lcd.print("        ");

  lcd.setCursor(0, 1);
  lcd.print("Vol:");
  lcd.print(volumeMl, 2);
  lcd.print(" mL     ");
}

void sendReading(float ph) {
  Serial.print("{\"ph\":");
  Serial.print(ph, 2);
  Serial.print(",\"volume\":");
  Serial.print(volumeMl, 2);
  Serial.println("}");
}

void endpointAlert() {
  running = false;
  digitalWrite(ledPin, LOW);
  tone(buzzerPin, 1200, 600);
  lcd.setCursor(0, 1);
  lcd.print("Endpoint reached");
}

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  Serial.begin(9600);

  buretteServo.attach(servoPin);
  buretteServo.write(95);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Titration");
  lcd.setCursor(0, 1);
  lcd.print("Send START");
}

void loop() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command == "START") {
      running = true;
      volumeMl = 0.0;
      digitalWrite(ledPin, HIGH);
      lcd.clear();
    }

    if (command == "STOP") {
      running = false;
      digitalWrite(ledPin, LOW);
    }
  }

  unsigned long now = millis();

  if (running && now - lastDoseMs > 900) {
    dispenseDrop();
    lastDoseMs = now;
  }

  if (now - lastSampleMs > 500) {
    float ph = readPh();
    showStatus(ph);
    sendReading(ph);

    if (running && abs(ph - endpointPh) <= endpointTolerance) {
      endpointAlert();
    }

    lastSampleMs = now;
  }
}
