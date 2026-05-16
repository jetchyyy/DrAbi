export type VitalAlertLevel = "normal" | "warning" | "critical";

export type VitalAlert = {
  key: string;
  label: string;
  level: VitalAlertLevel;
  status: string;
};

export type VitalValues = {
  temperature?: string | null;
  bloodPressure?: string | null;
  heartRate?: string | null;
  o2Sat?: string | null;
  respiratoryRate?: string | null;
  weight?: string | null;
  height?: string | null;
};

function parseNumericInput(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBloodPressureInput(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{2,3})\+?\s*\/\s*(\d{2,3})\+?$/);
  if (!match) {
    return null;
  }

  const systolic = Number(match[1]);
  const diastolic = Number(match[2]);
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
    return null;
  }

  return { systolic, diastolic };
}

export function evaluateVitalsAlerts(vitals: VitalValues) {
  const alerts: VitalAlert[] = [];

  const temperature = vitals.temperature?.trim() ?? "";
  if (temperature) {
    const value = parseNumericInput(temperature);
    if (value == null) {
      alerts.push({
        key: "temperature",
        label: "Temp",
        level: "warning",
        status: "Invalid format",
      });
    } else if (value < 35) {
      alerts.push({
        key: "temperature",
        label: "Temp",
        level: "critical",
        status: "Severe hypothermia",
      });
    } else if (value < 36) {
      alerts.push({
        key: "temperature",
        label: "Temp",
        level: "warning",
        status: "Low",
      });
    } else if (value <= 37.5) {
      alerts.push({
        key: "temperature",
        label: "Temp",
        level: "normal",
        status: "Normal",
      });
    } else if (value < 38.5) {
      alerts.push({
        key: "temperature",
        label: "Temp",
        level: "warning",
        status: "Fever",
      });
    } else {
      alerts.push({
        key: "temperature",
        label: "Temp",
        level: "critical",
        status: "High fever",
      });
    }
  }

  const bloodPressure = vitals.bloodPressure?.trim() ?? "";
  if (bloodPressure) {
    const parsed = parseBloodPressureInput(bloodPressure);
    if (!parsed) {
      alerts.push({
        key: "bloodPressure",
        label: "BP",
        level: "warning",
        status: "Invalid format",
      });
    } else if (parsed.systolic >= 180 || parsed.diastolic >= 120) {
      alerts.push({
        key: "bloodPressure",
        label: "BP",
        level: "critical",
        status: "Hypertensive Crisis",
      });
    } else if (parsed.systolic >= 140 || parsed.diastolic >= 90) {
      alerts.push({
        key: "bloodPressure",
        label: "BP",
        level: "warning",
        status: "Hypertension Stage 2",
      });
    } else if (parsed.systolic >= 130 || parsed.diastolic >= 80) {
      alerts.push({
        key: "bloodPressure",
        label: "BP",
        level: "warning",
        status: "Hypertension Stage 1",
      });
    } else if (parsed.systolic < 90 || parsed.diastolic < 60) {
      alerts.push({
        key: "bloodPressure",
        label: "BP",
        level: "warning",
        status: "Hypotension",
      });
    } else {
      alerts.push({
        key: "bloodPressure",
        label: "BP",
        level: "normal",
        status: "Normal",
      });
    }
  }

  const heartRate = vitals.heartRate?.trim() ?? "";
  if (heartRate) {
    const value = parseNumericInput(heartRate);
    if (value == null) {
      alerts.push({
        key: "heartRate",
        label: "HR",
        level: "warning",
        status: "Invalid format",
      });
    } else if (value < 40) {
      alerts.push({
        key: "heartRate",
        label: "HR",
        level: "critical",
        status: "Severe bradycardia",
      });
    } else if (value < 60) {
      alerts.push({
        key: "heartRate",
        label: "HR",
        level: "warning",
        status: "Bradycardia",
      });
    } else if (value <= 100) {
      alerts.push({
        key: "heartRate",
        label: "HR",
        level: "normal",
        status: "Normal",
      });
    } else if (value <= 120) {
      alerts.push({
        key: "heartRate",
        label: "HR",
        level: "warning",
        status: "Tachycardia",
      });
    } else {
      alerts.push({
        key: "heartRate",
        label: "HR",
        level: "critical",
        status: "Severe tachycardia",
      });
    }
  }

  const o2Sat = vitals.o2Sat?.trim() ?? "";
  if (o2Sat) {
    const value = parseNumericInput(o2Sat);
    if (value == null) {
      alerts.push({
        key: "o2Sat",
        label: "O2",
        level: "warning",
        status: "Invalid format",
      });
    } else if (value < 90) {
      alerts.push({
        key: "o2Sat",
        label: "O2",
        level: "critical",
        status: "Severe hypoxemia",
      });
    } else if (value < 95) {
      alerts.push({
        key: "o2Sat",
        label: "O2",
        level: "warning",
        status: "Low saturation",
      });
    } else {
      alerts.push({
        key: "o2Sat",
        label: "O2",
        level: "normal",
        status: "Normal",
      });
    }
  }

  const respiratoryRate = vitals.respiratoryRate?.trim() ?? "";
  if (respiratoryRate) {
    const value = parseNumericInput(respiratoryRate);
    if (value == null) {
      alerts.push({
        key: "respiratoryRate",
        label: "RR",
        level: "warning",
        status: "Invalid format",
      });
    } else if (value < 8) {
      alerts.push({
        key: "respiratoryRate",
        label: "RR",
        level: "critical",
        status: "Severe bradypnea",
      });
    } else if (value < 12) {
      alerts.push({
        key: "respiratoryRate",
        label: "RR",
        level: "warning",
        status: "Bradypnea",
      });
    } else if (value <= 20) {
      alerts.push({
        key: "respiratoryRate",
        label: "RR",
        level: "normal",
        status: "Normal",
      });
    } else if (value <= 24) {
      alerts.push({
        key: "respiratoryRate",
        label: "RR",
        level: "warning",
        status: "Tachypnea",
      });
    } else {
      alerts.push({
        key: "respiratoryRate",
        label: "RR",
        level: "critical",
        status: "Severe tachypnea",
      });
    }
  }

  const weight = vitals.weight?.trim() ?? "";
  const height = vitals.height?.trim() ?? "";
  if (weight && height) {
    const weightValue = parseNumericInput(weight);
    const heightValue = parseNumericInput(height);
    if (
      weightValue == null ||
      heightValue == null ||
      weightValue <= 0 ||
      heightValue <= 0
    ) {
      alerts.push({
        key: "bmi",
        label: "BMI",
        level: "warning",
        status: "Invalid format",
      });
    } else {
      const heightMeters = heightValue / 100;
      const bmi = weightValue / (heightMeters * heightMeters);

      if (bmi < 18.5) {
        alerts.push({
          key: "bmi",
          label: "BMI",
          level: "warning",
          status: "Underweight",
        });
      } else if (bmi < 25) {
        alerts.push({
          key: "bmi",
          label: "BMI",
          level: "normal",
          status: "Normal",
        });
      } else if (bmi < 30) {
        alerts.push({
          key: "bmi",
          label: "BMI",
          level: "warning",
          status: "Overweight",
        });
      } else if (bmi < 40) {
        alerts.push({
          key: "bmi",
          label: "BMI",
          level: "warning",
          status: "Obesity",
        });
      } else {
        alerts.push({
          key: "bmi",
          label: "BMI",
          level: "critical",
          status: "Severe obesity",
        });
      }
    }
  }

  return alerts;
}
