import {
  fetchConversionInboxFiltered,
  fetchConversionJourneyStartsFiltered,
  fetchConversionJourneyStartsForAdminFiltered,
  fetchConversionLogsFiltered,
  fetchConversionLogsForAdminFiltered,
  fetchConversionsFiltered,
  fetchConversionsForAdminFiltered,
  fetchConversionsForAdminUnfiltered,
  fetchConversionsUnfiltered,
  fetchGerenciaAvailabilitySummaries,
  fetchGerenciaAvailabilitySummariesForAdmin,
  setConversionViewVisibleFrom,
  type ConversionInboxRow,
  type ConversionJourneyStartRow,
  type ConversionLogRow,
  type ConversionRow,
  type FetchDateRange,
  type GerenciaAvailabilitySummary,
} from "@/lib/conversionsDb";
import type {
  ConversionLogDirectionFilter,
  ConversionLogEventFilter,
} from "@/lib/conversionLogFilters";
import type { ReportingCurrency } from "@/lib/currency";

type ViewerRequest = {
  viewerId: string;
};

type VisibleConversionsRequest = ViewerRequest & {
  limit?: number;
  range?: FetchDateRange | null;
};

type VisibleJourneyStartsRequest = ViewerRequest & {
  limit?: number;
  range?: FetchDateRange | null;
};

type VisibleLogsRequest = ViewerRequest & {
  limit?: number;
  offset?: number;
  range?: FetchDateRange | null;
  direction?: ConversionLogDirectionFilter;
  eventType?: ConversionLogEventFilter;
  workspaceCurrency?: ReportingCurrency | null;
};

type InboxRequest = ViewerRequest & {
  limit?: number;
  offset?: number;
  range?: FetchDateRange | null;
  action?: "all" | "CONTACT" | "LEAD" | "COMPLETEREGISTRATION" | "PURCHASE";
  search?: string;
  workspaceCurrency?: ReportingCurrency | null;
};

export interface ConversionPageDataSource {
  fetchVisibleConversions(
    request: VisibleConversionsRequest,
  ): Promise<ConversionRow[]>;
  fetchReportingConversions(
    request: ViewerRequest & { range?: FetchDateRange },
  ): Promise<ConversionRow[]>;
  fetchJourneyStarts(
    request: VisibleJourneyStartsRequest,
  ): Promise<ConversionJourneyStartRow[]>;
  fetchVisibleLogs(
    request: VisibleLogsRequest,
  ): Promise<ConversionLogRow[]>;
  fetchAvailability(
    request: ViewerRequest & { range: FetchDateRange; workspaceCurrency?: ReportingCurrency | null },
  ): Promise<GerenciaAvailabilitySummary[]>;
  fetchInbox?(
    request: InboxRequest,
  ): Promise<ConversionInboxRow[]>;
  setVisibleFrom?(
    request: ViewerRequest & { visibleFrom: Date | string },
  ): Promise<void>;
}

/**
 * El administrador conserva el alcance global de sus consultas.
 * viewerId sólo identifica quién ocultó registros en su propia vista.
 */
export const adminConversionPageDataSource = {
  fetchVisibleConversions: ({ viewerId, limit, range }: VisibleConversionsRequest) =>
    fetchConversionsForAdminFiltered(viewerId, limit, range ?? undefined),
  fetchReportingConversions: ({
    range,
  }: ViewerRequest & { range?: FetchDateRange }) =>
    fetchConversionsForAdminUnfiltered(range),
  fetchJourneyStarts: ({ viewerId, limit, range }: VisibleJourneyStartsRequest) =>
    fetchConversionJourneyStartsForAdminFiltered(viewerId, limit, range ?? undefined),
  fetchVisibleLogs: ({
    viewerId,
    limit,
    offset,
    direction,
    eventType,
    workspaceCurrency,
  }: VisibleLogsRequest) =>
    fetchConversionLogsForAdminFiltered(viewerId, limit, offset, {
      direction,
      eventType,
      workspaceCurrency,
    }),
  fetchAvailability: ({
    range,
    workspaceCurrency,
  }: ViewerRequest & { range: FetchDateRange; workspaceCurrency?: ReportingCurrency | null }) =>
    fetchGerenciaAvailabilitySummariesForAdmin(range, workspaceCurrency),
} satisfies ConversionPageDataSource;

/**
 * El dashboard mantiene todas las consultas limitadas al usuario autenticado.
 * El mismo id identifica también sus registros ocultos y preferencias de vista.
 */
export const dashboardConversionPageDataSource = {
  fetchVisibleConversions: ({ viewerId, limit, range }: VisibleConversionsRequest) =>
    fetchConversionsFiltered(viewerId, viewerId, limit, range ?? undefined),
  fetchReportingConversions: ({
    viewerId,
    range,
  }: ViewerRequest & { range?: FetchDateRange }) =>
    fetchConversionsUnfiltered(viewerId, range),
  fetchJourneyStarts: ({ viewerId, limit, range }: VisibleJourneyStartsRequest) =>
    fetchConversionJourneyStartsFiltered(viewerId, viewerId, limit, range ?? undefined),
  fetchVisibleLogs: ({
    viewerId,
    limit,
    offset,
    range,
    direction,
    eventType,
    workspaceCurrency,
  }: VisibleLogsRequest) =>
    fetchConversionLogsFiltered(
      viewerId,
      viewerId,
      limit,
      offset,
      range ?? undefined,
      { direction, eventType, workspaceCurrency },
    ),
  fetchAvailability: ({
    viewerId,
    range,
    workspaceCurrency,
  }: ViewerRequest & { range: FetchDateRange; workspaceCurrency?: ReportingCurrency | null }) =>
    fetchGerenciaAvailabilitySummaries(viewerId, range, workspaceCurrency),
  fetchInbox: ({
    viewerId,
    limit,
    offset,
    range,
    action,
    search,
    workspaceCurrency,
  }: InboxRequest) =>
    fetchConversionInboxFiltered(viewerId, viewerId, {
      limit,
      offset,
      range: range ?? undefined,
      action,
      search,
      workspaceCurrency,
    }),
  setVisibleFrom: ({
    viewerId,
    visibleFrom,
  }: ViewerRequest & { visibleFrom: Date | string }) =>
    setConversionViewVisibleFrom(viewerId, visibleFrom),
} satisfies ConversionPageDataSource;
