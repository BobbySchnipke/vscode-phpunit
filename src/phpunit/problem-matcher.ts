import * as yargsParser from 'yargs-parser';
import { Arguments } from 'yargs-parser';

export class EscapeValue {
    private values = {
        escape: ['||', "|'", '|n', '|r', '|]', '|['],
        unescape: ['|', "'", '\n', '\r', ']', '['],
    };

    private patterns: { unescape: RegExp[]; escape: RegExp[] };

    constructor() {
        this.patterns = {
            escape: this.toRegExp(this.values.escape),
            unescape: this.toRegExp(this.values.unescape),
        };
    }

    public escape(value: string | number | object) {
        return this.change(value, this.patterns.unescape, this.values.escape);
    }

    public unescape(value: string | number | object) {
        return this.change(value, this.patterns.escape, this.values.unescape);
    }

    public escapeSingleQuote(value: string | number | object) {
        return this.change(value, [new RegExp("\\|'", 'g')], ['%%%SINGLE_QUOTE%%%']);
    }

    public unescapeSingleQuote(value: string | number | object) {
        return this.change(value, [new RegExp('%%%SINGLE_QUOTE%%%', 'g')], ["'"]);
    }

    private change(value: string | number | any, from: RegExp[], to: string[]) {
        if (typeof value === 'object') {
            for (const x in value) {
                value[x] = this.change(value[x], from, to);
            }

            return value;
        }

        if (typeof value !== 'string') {
            return value;
        }

        for (const x in from) {
            value = value.replace(from[x], to[x]);
        }

        return value;
    }

    private toRegExp(values: string[]) {
        return values.map((str) => {
            str = str.replace(/([|\]\[])/g, (m) => `\\${m}`);

            return new RegExp(str, 'g');
        });
    }
}

export enum TestResultEvent {
    testSuiteStarted = 'testSuiteStarted',
    testSuiteFinished = 'testSuiteFinished',
    testStarted = 'testStarted',
    testFailed = 'testFailed',
    testIgnored = 'testIgnored',
    testFinished = 'testFinished',
}

export enum TestExtraResultEvent {
    testVersion = 'testVersion',
    testRuntime = 'testRuntime',
    testConfiguration = 'testConfiguration',
    testProcesses = 'testProcesses',
    testCount = 'testCount',
    timeAndMemory = 'timeAndMemory',
    testResultSummary = 'testResultSummary',
}

export type TestResultKind = TestResultEvent | TestExtraResultEvent;

type TestResultBase = {
    kind: TestResultKind;
    event: TestResultEvent;
    name: string;
    flowId: number;
};
type TestSuiteStarted = TestResultBase & {
    id?: string;
    file?: string;
    locationHint?: string;
    testId?: string;
};
type TestSuiteFinished = TestResultBase;
type TestStarted = TestResultBase & { id: string; file: string; locationHint: string };
type TestFinished = TestResultBase & { duration: number };

type TestFailed = TestFinished & {
    message: string;
    details: Array<{ file: string; line: number }>;

    type?: string;
    actual?: string;
    expected?: string;
};

type TestIgnored = TestFailed;
export type TestCount = {
    kind: TestResultKind;
    event: TestResultEvent;
    count: number;
    flowId: number;
};
export type TestVersion = {
    kind: TestResultKind;
    phpunit: string;
    paratest?: string;
    text: string;
};
export type TestRuntime = { kind: TestResultKind; runtime: string; text: string };
export type TestConfiguration = { kind: TestResultKind; configuration: string; text: string };
export type TestProcesses = { kind: TestResultKind; processes: string; text: string };

export type TimeAndMemory = { kind: TestResultKind; time: string; memory: string; text: string };
export type TestResultSummary = {
    kind: TestResultKind;
    tests?: number;
    assertions?: number;
    errors?: number;
    failures?: number;
    skipped?: number;
    incomplete?: number;
    risky?: number;
    text: string;
};

export type TestResult = TestSuiteStarted &
    TestSuiteFinished &
    TestStarted &
    TestFailed &
    TestIgnored &
    TestFinished;

export type Result = TestResult | TestResultSummary | TestCount | TimeAndMemory;

interface IParser<T> {
    is: (text: string) => boolean;
    parse: (text: string) => T;
}

class TestVersionParser implements IParser<TestVersion> {
    private pattern = new RegExp(
        '^(ParaTest\\s(v)?(?<paratest>[\\d.]+).+)?PHPUnit\\s(?<phpunit>[\\d.]+)',
        'i'
    );

    is(text: string): boolean {
        return !!text.match(this.pattern);
    }

    parse(text: string) {
        const groups = text.match(this.pattern)!.groups!;

        return {
            kind: TestExtraResultEvent.testVersion,
            phpunit: groups.phpunit,
            paratest: groups.paratest,
            text,
        };
    }
}

abstract class ValueParser<T> implements IParser<T> {
    protected constructor(private name: string, private kind: TestResultKind) {}

    private pattern = new RegExp(`^${this.name}:\\s+(?<${this.name}>.+)`, 'i');

    is(text: string): boolean {
        return !!text.match(this.pattern);
    }

    parse(text: string) {
        const groups = text.match(this.pattern)!.groups!;

        return {
            kind: this.kind,
            [this.name.toLowerCase()]: groups[this.name],
            text,
        } as T;
    }
}

class TestProcessesParser extends ValueParser<TestProcesses> {
    constructor() {
        super('Processes', TestExtraResultEvent.testProcesses);
    }
}

class TestRuntimeParser extends ValueParser<TestRuntime> {
    constructor() {
        super('Runtime', TestExtraResultEvent.testRuntime);
    }
}

class TestConfigurationParser extends ValueParser<TestConfiguration> {
    constructor() {
        super('Configuration', TestExtraResultEvent.testConfiguration);
    }
}

class TestResultSummaryParser implements IParser<TestResultSummary> {
    private readonly pattern = (() => {
        const items = ['Error(s)?', 'Failure(s)?', 'Skipped', 'Incomplete', 'Risky'];
        const end = '\\s(\\d+)[\\.\\s,]\\s?';
        const tests = `Test(s)?:${end}`;
        const assertions = `Assertions:${end}`;

        return new RegExp(
            `^OK\\s+\\(\\d+\\stest(s)?|^${tests}${assertions}((${items.join('|')}):${end})*`,
            'ig'
        );
    })();

    public is(text: string) {
        return !!text.match(this.pattern);
    }

    public parse(text: string) {
        const pattern = new RegExp(
            `((?<name>\\w+):\\s(?<count>\\d+)|(?<count2>\\d+)\\s(?<name2>\\w+))[.s,]?`,
            'ig'
        );
        const kind = TestExtraResultEvent.testResultSummary;

        return [...text.matchAll(pattern)].reduce(
            (result: any, match) => {
                const groups = match.groups!;
                const [name, count] = groups.name
                    ? [groups.name, groups.count]
                    : [groups.name2, groups.count2];
                result[this.normalize(name)] = parseInt(count, 10);

                return result;
            },
            { kind, text } as TestResultSummary
        );
    }

    private normalize(name: string) {
        name = name.toLowerCase();

        return ['skipped', 'incomplete', 'risky'].includes(name)
            ? name
            : `${name}${name.match(/s$/) ? '' : 's'}`;
    }
}

class TimeAndMemoryParser implements IParser<TimeAndMemory> {
    private readonly pattern = new RegExp(
        'Time:\\s(?<time>[\\d+:.]+(\\s\\w+)?),\\sMemory:\\s(?<memory>[\\d.]+\\s\\w+)'
    );

    public is(text: string) {
        return !!text.match(this.pattern);
    }

    public parse(text: string): TimeAndMemory {
        const { time, memory } = text.match(this.pattern)!.groups!;
        const kind = TestExtraResultEvent.timeAndMemory;

        return { time, memory, kind, text };
    }
}

export class Parser implements IParser<Result | undefined> {
    private readonly pattern = new RegExp('^\\s*#+teamcity');
    private readonly filePattern = new RegExp('(s+)?(?<file>.+):(?<line>\\d+)$');
    private readonly parsers = [
        new TestVersionParser(),
        new TestRuntimeParser(),
        new TestConfigurationParser(),
        new TestProcessesParser(),
        new TimeAndMemoryParser(),
        new TestResultSummaryParser(),
    ];

    constructor(private escapeValue: EscapeValue) {}

    public parse(text: string): Result | undefined {
        return this.is(text)
            ? this.doParse(text)
            : this.parsers.find((parser) => parser.is(text))?.parse(text);
    }

    public is(text: string): boolean {
        return !!text.match(this.pattern);
    }

    private doParse(text: string) {
        text = text
            .trim()
            .replace(this.pattern, '')
            .replace(/^\[|]$/g, '');

        const argv = this.toTeamcityArgv(text);
        argv.kind = argv.event;

        return {
            ...argv,
            ...this.parseLocationHint(argv),
            ...this.parseDetails(argv),
        } as TestResult;
    }

    private parseDetails(argv: Pick<Arguments, string | number>) {
        if (!('details' in argv)) {
            return {};
        }

        let message = argv.message;
        const details = this.parseFileAndLine(argv.message);
        details.forEach(({ file, line }) => {
            message = message.replace(`${file}:${line}`, '');
        });

        return {
            message: message.trim(),
            details: [...details, ...this.parseFileAndLine(argv.details)],
        };
    }

    private parseFileAndLine(text: string) {
        return text
            .trim()
            .split(/\r\n|\n/g)
            .filter((input: string) => input.match(this.filePattern))
            .map((input: string) => {
                const { file, line } = input.match(this.filePattern)!.groups!;

                return {
                    file: file.replace(/^(-)+/, '').trim(),
                    line: parseInt(line, 10),
                };
            });
    }

    private parseLocationHint(argv: Pick<Arguments, string | number>) {
        if (!argv.locationHint) {
            return {};
        }

        const locationHint = argv.locationHint;
        const split = locationHint
            .replace(/^php_qn:\/\//, '')
            .replace(/::\\/g, '::')
            .split('::');

        const file = split.shift();
        const id = split.join('::');
        const testId = id.replace(/\swith\sdata\sset\s[#"].+$/, '');

        return { id, file, testId };
    }

    private toTeamcityArgv(text: string): Pick<Arguments, string | number> {
        text = this.escapeValue.escapeSingleQuote(text) as string;
        text = this.escapeValue.unescape(text) as string;

        const [eventName, ...args] = yargsParser(text)._;
        const command = [
            `--event='${eventName}'`,
            ...args.map((parameter) => `--${parameter}`),
        ].join(' ');

        const { _, $0, ...argv } = yargsParser(command);

        return this.escapeValue.unescapeSingleQuote(argv);
    }
}

class ProblemMatcher {
    private collect = new Map<string, TestResult>();

    private lookup: { [p: string]: Function } = {
        [TestResultEvent.testSuiteStarted]: this.handleStarted,
        [TestResultEvent.testStarted]: this.handleStarted,
        [TestResultEvent.testSuiteFinished]: this.handleFinished,
        [TestResultEvent.testFinished]: this.handleFinished,
        [TestResultEvent.testFailed]: this.handleFault,
        [TestResultEvent.testIgnored]: this.handleFault,
    };

    constructor(private parser: Parser) {}

    parse(
        input: string | Buffer
    ): TestResult | TestCount | TestResultSummary | TimeAndMemory | undefined {
        const result = this.parser.parse(input.toString());

        return this.isTestResult(result)
            ? this.lookup[(result as TestResult).event]?.call(this, result as TestResult)
            : result;
    }

    private isTestResult(result: any | undefined) {
        return result && 'event' in result && 'name' in result && 'flowId' in result;
    }

    private handleStarted(testResult: TestResult) {
        const id = this.generateId(testResult);
        this.collect.set(id, { ...testResult });

        return this.collect.get(id);
    }

    private handleFault(testResult: TestResult) {
        const id = this.generateId(testResult);
        const prevData = this.collect.get(id);

        if (!prevData || prevData.kind === TestResultEvent.testStarted) {
            this.collect.set(id, { ...(prevData ?? {}), ...testResult });
            return;
        }

        if (testResult.message) {
            prevData.message += '\n\n' + testResult.message;
        }
        prevData.details.push(...testResult.details);

        this.collect.set(id, prevData);
    }

    private handleFinished(testResult: TestResult) {
        const id = this.generateId(testResult);

        const prevData = this.collect.get(id)!;
        const event = this.isFault(prevData) ? prevData.event : testResult.event;
        const kind = event;
        const result = { ...prevData, ...testResult, event, kind };
        this.collect.delete(id);

        return result;
    }

    private isFault(testResult: TestResult) {
        return [TestResultEvent.testFailed, TestResultEvent.testIgnored].includes(testResult.event);
    }

    private generateId(testResult: TestResult) {
        return `${testResult.name}-${testResult.flowId}`;
    }
}

export const parser = new Parser(new EscapeValue());
export const problemMatcher = new ProblemMatcher(parser);
