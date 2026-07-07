// API・画面間でやり取りするデータの型定義

export type VehicleDTO = {
  id: number;
  name: string;
  number: string;
  sortOrder: number;
  isActive: boolean;
};

export type DriverDTO = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type VehicleLogDTO = {
  id: number;
  date: string; // "YYYY-MM-DD"
  vehicleId: number;
  driverId: number;
  destination: string; // 改行区切り
  endMeter: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: VehicleDTO;
  driver: DriverDTO;
};

export type VehicleLogInput = {
  date: string;
  vehicleId: number;
  driverId: number;
  destination: string;
  endMeter: number;
  note?: string | null;
};
