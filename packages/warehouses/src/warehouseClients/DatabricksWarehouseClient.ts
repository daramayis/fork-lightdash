import { DBSQLClient } from '@databricks/sql';
import IDBSQLClient, {
    IDBSQLConnectionOptions,
} from '@databricks/sql/dist/contracts/IDBSQLClient';
import IDBSQLSession from '@databricks/sql/dist/contracts/IDBSQLSession';
import IOperation from '@databricks/sql/dist/contracts/IOperation';
import { TTypeId as DatabricksDataTypes } from '@databricks/sql/thrift/TCLIService_types';
import {
    assertUnreachable,
    CreateDatabricksCredentials,
    DimensionType,
    WarehouseConnectionError,
    WarehouseQueryError,
} from '@lightdash/common';
import { WarehouseCatalog, WarehouseClient } from '../types';

type SparkSchemaResult = {
    TABLE_CAT: string;
    TABLE_SCHEM: string;
    TABLE_NAME: string;
    COLUMN_NAME: string;
    DATA_TYPE: number;
    TYPE_NAME: string;
};

const convertDataTypeToDimensionType = (
    type: DatabricksDataTypes,
): DimensionType => {
    switch (type) {
        case DatabricksDataTypes.BOOLEAN_TYPE:
            return DimensionType.BOOLEAN;
        case DatabricksDataTypes.TINYINT_TYPE:
        case DatabricksDataTypes.SMALLINT_TYPE:
        case DatabricksDataTypes.INT_TYPE:
        case DatabricksDataTypes.BIGINT_TYPE:
        case DatabricksDataTypes.FLOAT_TYPE:
        case DatabricksDataTypes.DOUBLE_TYPE:
        case DatabricksDataTypes.DECIMAL_TYPE:
            return DimensionType.NUMBER;
        case DatabricksDataTypes.DATE_TYPE:
            return DimensionType.DATE;
        case DatabricksDataTypes.TIMESTAMP_TYPE:
            return DimensionType.TIMESTAMP;
        case DatabricksDataTypes.STRING_TYPE:
        case DatabricksDataTypes.BINARY_TYPE:
        case DatabricksDataTypes.ARRAY_TYPE:
        case DatabricksDataTypes.STRUCT_TYPE:
        case DatabricksDataTypes.UNION_TYPE:
        case DatabricksDataTypes.USER_DEFINED_TYPE:
        case DatabricksDataTypes.INTERVAL_YEAR_MONTH_TYPE:
        case DatabricksDataTypes.INTERVAL_DAY_TIME_TYPE:
        case DatabricksDataTypes.NULL_TYPE:
        case DatabricksDataTypes.MAP_TYPE:
        case DatabricksDataTypes.CHAR_TYPE:
        case DatabricksDataTypes.VARCHAR_TYPE:
            return DimensionType.STRING;
        default:
            return assertUnreachable(type);
    }
};

// https://infocenter.sybase.com/help/index.jsp?topic=/com.sybase.infocenter.dc36273.1570/html/sprocs/CIHHGDBC.htm
enum DatabricksFieldTypes {
    CHAR = 1,
    DECIMAL = 2,
    DOUBLE_PRECISION = 8,
    FLOAT = 6,
    INTEGER = 4,
    NUMERIC = 2,
    REAL = 7,
    SMALL_INT = 5,
    BIG_INT = -5,
    BINARY = -2,
    BIT = -7,
    DATE = 9,
    TIME = 10,
    TIMESTAMP = 11,
    TINY_INT = -6,
}

const mapFieldType = (type: DatabricksFieldTypes): DimensionType => {
    switch (type) {
        case DatabricksFieldTypes.BIT:
        case DatabricksFieldTypes.BINARY:
            return DimensionType.BOOLEAN;
        case DatabricksFieldTypes.TINY_INT:
        case DatabricksFieldTypes.SMALL_INT:
        case DatabricksFieldTypes.INTEGER:
        case DatabricksFieldTypes.BIG_INT:
        case DatabricksFieldTypes.FLOAT:
        case DatabricksFieldTypes.REAL:
        case DatabricksFieldTypes.DOUBLE_PRECISION:
        case DatabricksFieldTypes.DECIMAL:
        case DatabricksFieldTypes.NUMERIC:
            return DimensionType.NUMBER;
        case DatabricksFieldTypes.DATE:
            return DimensionType.DATE;
        case DatabricksFieldTypes.TIMESTAMP:
            return DimensionType.TIMESTAMP;
        default:
            return DimensionType.STRING;
    }
};

export class DatabricksWarehouseClient implements WarehouseClient {
    connectionOptions: IDBSQLConnectionOptions;

    constructor({
        serverHostName,
        port,
        personalAccessToken,
        httpPath,
    }: CreateDatabricksCredentials) {
        this.connectionOptions = {
            token: personalAccessToken,
            host: serverHostName,
            path: httpPath,
            port,
        };
    }

    private async getSession() {
        const client = new DBSQLClient();
        let connection: IDBSQLClient;
        let session: IDBSQLSession;

        try {
            connection = await client.connect(this.connectionOptions);
            session = await connection.openSession();
        } catch (e) {
            throw new WarehouseConnectionError(e.message);
        }

        return {
            session,
            close: async () => {
                await session.close();
                await connection.close();
            },
        };
    }

    async runQuery(sql: string) {
        const { session, close } = await this.getSession();
        let query: IOperation | null = null;

        try {
            query = await session.executeStatement(sql, {
                runAsync: true,
            });

            const schema = await query.getSchema();
            const result = await query.fetchAll();

            const fields = (schema?.columns ?? []).reduce<
                Record<string, { type: DimensionType }>
            >(
                (acc, column) => ({
                    ...acc,
                    [column.columnName]: {
                        type: convertDataTypeToDimensionType(
                            column.typeDesc.types[0]?.primitiveEntry?.type ??
                                DatabricksDataTypes.STRING_TYPE,
                        ),
                    },
                }),
                {},
            );

            return { fields, rows: result };
        } catch (e) {
            throw new WarehouseQueryError(e.message);
        } finally {
            if (query) await query.close();
            await close();
        }
    }

    async test(): Promise<void> {
        await this.runQuery('SELECT 1');
    }

    async getCatalog(
        requests: {
            database: string;
            schema: string;
            table: string;
        }[],
    ) {
        const { session, close } = await this.getSession();
        let results: SparkSchemaResult[][];

        try {
            const promises = requests.map(async (request) => {
                let query: IOperation | null = null;
                try {
                    query = await session.getColumns({
                        catalogName: request.database,
                        schemaName: request.schema,
                        tableName: request.table,
                    });

                    const result =
                        (await query.fetchAll()) as SparkSchemaResult[];

                    return result;
                } catch (e) {
                    throw new WarehouseQueryError(e.message);
                } finally {
                    if (query) query.close();
                }
            });
            results = await Promise.all(promises);
        } finally {
            await close();
        }

        return results.reduce<WarehouseCatalog>(
            (acc, result, index) => {
                const columns = Object.fromEntries<DimensionType>(
                    result.map((col) => [
                        col.COLUMN_NAME,
                        mapFieldType(col.DATA_TYPE),
                    ]),
                );
                const { schema, table } = requests[index];

                acc.SPARK[schema] = acc.SPARK[schema] || {};
                acc.SPARK[schema][table] = columns;

                return acc;
            },
            { SPARK: {} } as WarehouseCatalog,
        );
    }
}
