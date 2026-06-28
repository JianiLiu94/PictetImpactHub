import {
  AcidificationIcon,
  ClimateChangeIcon,
  ConnectivityIcon,
  EmploymentIcon,
  EnergyIcon,
  EutrophicationIcon,
  HealthIcon,
  HousingIcon,
  IncomeWealthIcon,
  KnowledgeIcon,
  LandUseIcon,
  LeisureIcon,
  MobilityIcon,
  NutritionIcon,
  SafetyIcon,
  WaterIcon,
  WaterStressIcon,
} from "./components/Icon";

const ICONS_BY_CATEGORY: Record<string, React.ReactNode> = {
  connectivity: <ConnectivityIcon />,
  employment: <EmploymentIcon />,
  energy: <EnergyIcon />,
  health: <HealthIcon />,
  housing: <HousingIcon />,
  income_wealth: <IncomeWealthIcon />,
  knowledge: <KnowledgeIcon />,
  leisure: <LeisureIcon />,
  mobility: <MobilityIcon />,
  nutrition: <NutritionIcon />,
  safety: <SafetyIcon />,
  water: <WaterIcon />,
  acidification: <AcidificationIcon />,
  climate_change: <ClimateChangeIcon />,
  eutrophication: <EutrophicationIcon />,
  land_use: <LandUseIcon />,
  water_stress: <WaterStressIcon />,
};

/** Returns the icon for a known scope/category key, or null if there isn't one. */
export function categoryIcon(category: string): React.ReactNode | null {
  return ICONS_BY_CATEGORY[category] ?? null;
}
