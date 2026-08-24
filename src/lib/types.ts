export type DepartmentDTO = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type VehicleDTO = {
  id: number;
  name: string;
  number: string;
  departmentId: number | null;
  sortOrder: number;
  isActive: boolean;
  department?: DepartmentDTO | null;
};

export type VehicleLogDTO = {
  id: number;
  date: string;
  vehicleId: number;
  destination: string;
  endMeter: number;
  fuelLocation: string | null;
  fuelAmount: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: VehicleDTO;
};

export type VehicleLogInput = {
  date: string;
  vehicleId: number;
  destination: string;
  endMeter: number;
  fuelLocation?: string | null;
  fuelAmount?: number | null;
  note?: string | null;
};
