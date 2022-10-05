import {
    Field,
    Filters,
    getItemId,
    isDimension,
    ResultRow,
    TableCalculation,
} from '@lightdash/common';
import React, {
    createContext,
    FC,
    useCallback,
    useContext,
    useState,
} from 'react';
import { EChartSeries } from '../../hooks/echarts/useEcharts';
import { TableColumn } from '../common/Table/types';
import { EchartSeriesClickEvent } from '../SimpleChart';

type UnderlyingDataConfig = {
    value: ResultRow[0]['value'];
    meta: TableColumn['meta'];
    row: ResultRow;
    dimensions?: string[];
    pivot?: { fieldId: string; value: any };
};

type UnderlyingDataContext = {
    tableName: string;
    filters?: Filters;
    config: UnderlyingDataConfig | undefined;
    isModalOpen: boolean;
    viewData: (
        value: ResultRow[0]['value'],
        meta: TableColumn['meta'],
        row: ResultRow,
        dimensions?: string[],
        pivot?: { fieldId: string; value: any },
    ) => void;
    closeModal: () => void;
};

export const getDataFromChartClick = (
    e: EchartSeriesClickEvent,
    pivot: string | undefined,
    itemsMap: Record<string, Field | TableCalculation>,
    series: EChartSeries[],
) => {
    const selectedFields = Object.values(itemsMap).filter((item) =>
        e.dimensionNames.includes(getItemId(item)),
    );
    const selectedMetricsAndTableCalculations = selectedFields.filter(
        (item) => !isDimension(item),
    );

    const selectedField =
        selectedMetricsAndTableCalculations.length > 0
            ? selectedMetricsAndTableCalculations[0]
            : selectedFields[0];
    const selectedValue = e.data[getItemId(selectedField)];
    const row: ResultRow = Object.entries(e.data as Record<string, any>).reduce(
        (acc, entry) => {
            const [key, val] = entry;
            return { ...acc, [key]: { value: { raw: val, formatted: val } } };
        },
        {},
    );

    const withPivot =
        pivot !== undefined
            ? { fieldId: pivot, value: series[e.seriesIndex].pivotRawValue }
            : undefined;

    return {
        meta: { item: selectedField },
        value: { raw: selectedValue, formatted: selectedValue },
        row,
        pivot: withPivot,
    };
};
const Context = createContext<UnderlyingDataContext | undefined>(undefined);

type Props = {
    tableName: string;
    filters?: Filters;
};

export const UnderlyingDataProvider: FC<Props> = ({
    tableName,
    filters,
    children,
}) => {
    const [config, setConfig] = useState<UnderlyingDataConfig>();

    const closeModal = useCallback(() => {
        setConfig(undefined);
    }, []);

    const viewData = useCallback(
        (
            value: ResultRow[0]['value'],
            meta: TableColumn['meta'],
            row: ResultRow,
            dimensions?: string[],
            pivot?: { fieldId: string; value: any },
        ) => {
            setConfig({
                value,
                meta,
                row,
                dimensions,
                pivot,
            });
        },
        [setConfig],
    );

    return (
        <Context.Provider
            value={{
                tableName,
                filters,
                config,
                viewData,
                isModalOpen: !!config,
                closeModal,
            }}
        >
            {children}
        </Context.Provider>
    );
};

export function useUnderlyingDataContext(): UnderlyingDataContext {
    const context = useContext(Context);
    if (context === undefined) {
        throw new Error(
            'useUnderlyingDataContext must be used within a UnderlyingDataProvider',
        );
    }
    return context;
}

export default UnderlyingDataProvider;
