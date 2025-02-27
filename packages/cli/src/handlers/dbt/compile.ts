import { ParseError } from '@lightdash/common';
import execa from 'execa';

export type DbtCompileOptions = {
    profilesDir: string;
    projectDir: string;
    target: string | undefined;
    profile: string | undefined;
    select: string[] | undefined;
    models: string[] | undefined;
    vars: string | undefined;
    threads: string | undefined;
    noVersionCheck: boolean | undefined;
    exclude: string | undefined;
    selector: string | undefined;
    state: string | undefined;
    fullRefresh: boolean | undefined;
    verbose: boolean;
};

const dbtCompileArgs = [
    'profilesDir',
    'projectDir',
    'target',
    'profile',
    'select',
    'models',
    'vars',
    'threads',
    'noVersionCheck',
    'exclude',
    'selector',
    'state',
    'fullRefresh',
];

const camelToSnakeCase = (str: string) =>
    str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const optionsToArgs = (options: DbtCompileOptions): string[] =>
    Object.entries(options).reduce<string[]>((acc, [key, value]) => {
        if (value !== undefined && dbtCompileArgs.includes(key)) {
            const argKey = `--${camelToSnakeCase(key)}`;
            if (typeof value !== 'boolean') {
                return [...acc, argKey, value.toString()];
            }
            return [...acc, argKey];
        }
        return acc;
    }, []);
export const dbtCompile = async (options: DbtCompileOptions) => {
    try {
        const args = optionsToArgs(options);
        await execa('dbt', ['compile', ...args]);
    } catch (e: any) {
        throw new ParseError(`Failed to run dbt compile:\n  ${e.message}`);
    }
};
