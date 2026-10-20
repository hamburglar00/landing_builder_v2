"use client";

import { useCallback, useMemo, useState } from "react";

const ALL_FILTER_VALUES = "__all__";

export function useConversionStatsFilters() {
  const [statsLandingFilter, setStatsLandingFilter] = useState<string>(ALL_FILTER_VALUES);
  const [statsPixelFilter, setStatsPixelFilter] = useState<string>(ALL_FILTER_VALUES);
  const [statsGerenciaFilter, setStatsGerenciaFilter] = useState<string[]>([]);
  const [statsTelefonoFilter, setStatsTelefonoFilter] = useState<string>(ALL_FILTER_VALUES);
  const [statsFromMetaAdsFilter, setStatsFromMetaAdsFilter] = useState<string>(ALL_FILTER_VALUES);
  const [statsSourcePlatformFilter, setStatsSourcePlatformFilter] = useState<string>(ALL_FILTER_VALUES);
  const [statsSexoFilter, setStatsSexoFilter] = useState<string>(ALL_FILTER_VALUES);
  const [statsCampaignFilter, setStatsCampaignFilter] = useState<string[]>([]);
  const [statsAdSetFilter, setStatsAdSetFilter] = useState<string[]>([]);
  const [statsAdFilter, setStatsAdFilter] = useState<string[]>([]);
  const [statsDeviceFilter, setStatsDeviceFilter] = useState<string>(ALL_FILTER_VALUES);
  const [statsFilterModalOpen, setStatsFilterModalOpen] = useState(false);
  const [draftLandingFilter, setDraftLandingFilter] = useState<string>(ALL_FILTER_VALUES);
  const [draftPixelFilter, setDraftPixelFilter] = useState<string>(ALL_FILTER_VALUES);
  const [draftGerenciaFilter, setDraftGerenciaFilter] = useState<string[]>([]);
  const [draftTelefonoFilter, setDraftTelefonoFilter] = useState<string>(ALL_FILTER_VALUES);
  const [draftFromMetaAdsFilter, setDraftFromMetaAdsFilter] = useState<string>(ALL_FILTER_VALUES);
  const [draftSourcePlatformFilter, setDraftSourcePlatformFilter] = useState<string>(ALL_FILTER_VALUES);
  const [draftSexoFilter, setDraftSexoFilter] = useState<string>(ALL_FILTER_VALUES);
  const [draftCampaignFilter, setDraftCampaignFilter] = useState<string[]>([]);
  const [draftAdSetFilter, setDraftAdSetFilter] = useState<string[]>([]);
  const [draftAdFilter, setDraftAdFilter] = useState<string[]>([]);
  const [draftDeviceFilter, setDraftDeviceFilter] = useState<string>(ALL_FILTER_VALUES);

  const openStatsFilterModal = useCallback(() => {
    setDraftLandingFilter(statsSourcePlatformFilter === "landing" ? statsLandingFilter : ALL_FILTER_VALUES);
    setDraftPixelFilter(statsPixelFilter);
    setDraftGerenciaFilter([...statsGerenciaFilter]);
    setDraftTelefonoFilter(statsTelefonoFilter);
    setDraftFromMetaAdsFilter(statsFromMetaAdsFilter);
    setDraftSourcePlatformFilter(statsSourcePlatformFilter);
    setDraftSexoFilter(statsSexoFilter);
    setDraftCampaignFilter([...statsCampaignFilter]);
    setDraftAdSetFilter([...statsAdSetFilter]);
    setDraftAdFilter([...statsAdFilter]);
    setDraftDeviceFilter(statsDeviceFilter);
    setStatsFilterModalOpen(true);
  }, [
    statsLandingFilter,
    statsPixelFilter,
    statsGerenciaFilter,
    statsTelefonoFilter,
    statsFromMetaAdsFilter,
    statsSourcePlatformFilter,
    statsSexoFilter,
    statsCampaignFilter,
    statsAdSetFilter,
    statsAdFilter,
    statsDeviceFilter,
  ]);

  const applyStatsFilters = useCallback(() => {
    setStatsLandingFilter(draftSourcePlatformFilter === "landing" ? draftLandingFilter : ALL_FILTER_VALUES);
    setStatsPixelFilter(draftPixelFilter);
    setStatsGerenciaFilter([...draftGerenciaFilter]);
    setStatsTelefonoFilter(draftTelefonoFilter);
    setStatsFromMetaAdsFilter(draftFromMetaAdsFilter);
    setStatsSourcePlatformFilter(draftSourcePlatformFilter);
    setStatsSexoFilter(draftSexoFilter);
    setStatsCampaignFilter([...draftCampaignFilter]);
    setStatsAdSetFilter([...draftAdSetFilter]);
    setStatsAdFilter([...draftAdFilter]);
    setStatsDeviceFilter(draftDeviceFilter);
    setStatsFilterModalOpen(false);
  }, [
    draftLandingFilter,
    draftPixelFilter,
    draftGerenciaFilter,
    draftTelefonoFilter,
    draftFromMetaAdsFilter,
    draftSourcePlatformFilter,
    draftSexoFilter,
    draftCampaignFilter,
    draftAdSetFilter,
    draftAdFilter,
    draftDeviceFilter,
  ]);

  const clearAllStatsFilters = useCallback(() => {
    setStatsLandingFilter(ALL_FILTER_VALUES);
    setStatsPixelFilter(ALL_FILTER_VALUES);
    setStatsGerenciaFilter([]);
    setStatsTelefonoFilter(ALL_FILTER_VALUES);
    setStatsFromMetaAdsFilter(ALL_FILTER_VALUES);
    setStatsSourcePlatformFilter(ALL_FILTER_VALUES);
    setStatsSexoFilter(ALL_FILTER_VALUES);
    setStatsCampaignFilter([]);
    setStatsAdSetFilter([]);
    setStatsAdFilter([]);
    setStatsDeviceFilter(ALL_FILTER_VALUES);
    setDraftLandingFilter(ALL_FILTER_VALUES);
    setDraftPixelFilter(ALL_FILTER_VALUES);
    setDraftGerenciaFilter([]);
    setDraftTelefonoFilter(ALL_FILTER_VALUES);
    setDraftFromMetaAdsFilter(ALL_FILTER_VALUES);
    setDraftSourcePlatformFilter(ALL_FILTER_VALUES);
    setDraftSexoFilter(ALL_FILTER_VALUES);
    setDraftCampaignFilter([]);
    setDraftAdSetFilter([]);
    setDraftAdFilter([]);
    setDraftDeviceFilter(ALL_FILTER_VALUES);
  }, []);

  const statsFilterValues = useMemo(
    () => [
      statsSourcePlatformFilter === "landing" ? statsLandingFilter : ALL_FILTER_VALUES,
      statsPixelFilter,
      statsGerenciaFilter.length > 0
        ? statsGerenciaFilter.join(", ")
        : ALL_FILTER_VALUES,
      statsTelefonoFilter,
      statsFromMetaAdsFilter,
      statsSourcePlatformFilter,
      statsSexoFilter,
      statsCampaignFilter.length > 0
        ? statsCampaignFilter.join(", ")
        : ALL_FILTER_VALUES,
      statsAdSetFilter.length > 0
        ? statsAdSetFilter.join(", ")
        : ALL_FILTER_VALUES,
      statsAdFilter.length > 0
        ? statsAdFilter.join(", ")
        : ALL_FILTER_VALUES,
      statsDeviceFilter,
    ],
    [
      statsLandingFilter,
      statsPixelFilter,
      statsGerenciaFilter,
      statsTelefonoFilter,
      statsFromMetaAdsFilter,
      statsSourcePlatformFilter,
      statsSexoFilter,
      statsCampaignFilter,
      statsAdSetFilter,
      statsAdFilter,
      statsDeviceFilter,
    ],
  );
  const statsFiltersCount = useMemo(
    () => statsFilterValues.filter((value) => value !== ALL_FILTER_VALUES).length,
    [statsFilterValues],
  );
  const hasStatsFiltersApplied = statsFiltersCount > 0;

  return {
    statsLandingFilter,
    setStatsLandingFilter,
    statsPixelFilter,
    setStatsPixelFilter,
    statsGerenciaFilter,
    setStatsGerenciaFilter,
    statsTelefonoFilter,
    setStatsTelefonoFilter,
    statsFromMetaAdsFilter,
    setStatsFromMetaAdsFilter,
    statsSourcePlatformFilter,
    setStatsSourcePlatformFilter,
    statsSexoFilter,
    setStatsSexoFilter,
    statsCampaignFilter,
    statsAdSetFilter,
    statsAdFilter,
    setStatsCampaignFilter,
    setStatsAdSetFilter,
    setStatsAdFilter,
    statsDeviceFilter,
    setStatsDeviceFilter,
    statsFilterModalOpen,
    setStatsFilterModalOpen,
    draftLandingFilter,
    setDraftLandingFilter,
    draftPixelFilter,
    setDraftPixelFilter,
    draftGerenciaFilter,
    setDraftGerenciaFilter,
    draftTelefonoFilter,
    setDraftTelefonoFilter,
    draftFromMetaAdsFilter,
    setDraftFromMetaAdsFilter,
    draftSourcePlatformFilter,
    setDraftSourcePlatformFilter,
    draftSexoFilter,
    setDraftSexoFilter,
    draftCampaignFilter,
    draftAdSetFilter,
    draftAdFilter,
    setDraftCampaignFilter,
    setDraftAdSetFilter,
    setDraftAdFilter,
    draftDeviceFilter,
    setDraftDeviceFilter,
    openStatsFilterModal,
    applyStatsFilters,
    clearAllStatsFilters,
    hasStatsFiltersApplied,
    statsFiltersCount,
  };
}
