import { beforeAll, describe, expect, it } from '@jest/globals';
import { readFile } from 'fs/promises';
import { propertyParser } from './property-parser';
import { parse, Test } from './parser';
import { phpUnitProject } from '../__tests__/utils';

const uniqueId = (namespace: string, _class: string, method: string) => {
    return propertyParser.uniqueId(namespace, _class, method);
};
const qualifiedClass = (namespace: string, _class: string) => {
    return propertyParser.qualifiedClass(namespace, _class);
};

describe('Parser Test', () => {
    describe('PHPUnit', () => {
        let suites: Test[];
        const givenTest = (method: string) =>
            suites[0].children.find((test) => test.method === method);

        describe('parse AssertionsTest', () => {
            const file = phpUnitProject('tests/AssertionsTest.php');
            const namespace = 'Recca0120\\VSCode\\Tests';
            const _class = 'AssertionsTest';

            beforeAll(async () => {
                const buffer = await readFile(file);
                suites = parse(buffer.toString(), file)!;
            });

            it('it should parse test_passed', () => {
                const method = 'test_passed';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 12, character: 4 },
                        end: { line: 15, character: 5 },
                    })
                );
            });

            it('it should parse test_failed', () => {
                const method = 'test_failed';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        annotations: { depends: ['test_passed'] },
                        start: { line: 20, character: 4 },
                        end: { line: 23, character: 5 },
                        // end: { line: 20, character: 29 },
                    })
                );
            });

            it('it should parse test_is_not_same', () => {
                const method = 'test_is_not_same';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 25, character: 4 },
                        end: { line: 28, character: 5 },
                        // end: { line: 25, character: 34 },
                    })
                );
            });

            it('it should parse test_risky', () => {
                const method = 'test_risky';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 30, character: 4 },
                        end: { line: 33, character: 5 },
                        // end: { line: 30, character: 28 },
                    })
                );
            });

            it('it should parse annotation_test', () => {
                const method = 'annotation_test';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 38, character: 4 },
                        end: { line: 41, character: 5 },
                    })
                );
            });

            it('it should parse test_skipped', () => {
                const method = 'test_skipped';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 43, character: 4 },
                        end: { line: 46, character: 5 },
                    })
                );
            });

            it('it should parse test_incomplete', () => {
                const method = 'test_incomplete';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 48, character: 4 },
                        end: { line: 51, character: 5 },
                    })
                );
            });

            it('it should parse addition_provider', () => {
                const method = 'addition_provider';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        annotations: {
                            dataProvider: ['additionProvider'],
                            depends: ['test_passed'],
                        },
                        start: { line: 60, character: 4 },
                        end: { line: 63, character: 5 },
                    })
                );
            });

            it('it should parse testdox annotation', () => {
                const method = 'balanceIsInitiallyZero';
                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        annotations: { testdox: ['has an initial balance of zero'] },
                        start: { line: 79, character: 4 },
                        end: { line: 82, character: 5 },
                    })
                );
            });
        });

        describe('parse AbstractTest', () => {
            const file = phpUnitProject('tests/AbstractTest.php');

            beforeAll(async () => {
                const buffer = await readFile(file);
                suites = parse(buffer.toString(), file)!;
            });

            it('it should not parse abstract class', () => {
                expect(suites).toHaveLength(0);
            });
        });

        describe('parse StaticMethodTest', () => {
            const file = phpUnitProject('tests/StaticMethodTest.php');
            const namespace = 'Recca0120\\VSCode\\Tests';
            const _class = 'StaticMethodTest';

            beforeAll(async () => {
                const buffer = await readFile(file);
                suites = parse(buffer.toString(), file)!;
            });

            it('it should parse test_static_public_fail', () => {
                const method = 'test_static_public_fail';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 9, character: 4 },
                        end: { line: 11, character: 5 },
                    })
                );

                expect(suites).toHaveLength(1);
            });
        });

        describe('parse HasPropertyTest', () => {
            const file = phpUnitProject('tests/SubFolder/HasPropertyTest.php');
            const namespace = 'Recca0120\\VSCode\\Tests\\SubFolder';
            const _class = 'HasPropertyTest';

            beforeAll(async () => {
                const buffer = await readFile(file);
                suites = parse(buffer.toString(), file)!;
            });

            it('it should parse property', () => {
                const method = 'property';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 17, character: 4 },
                        end: { line: 20, character: 5 },
                    })
                );

                expect(suites).toHaveLength(1);
            });
        });

        describe('parse LeadingCommentsTest', () => {
            const file = phpUnitProject('tests/SubFolder/LeadingCommentsTest.php');
            const namespace = 'Recca0120\\VSCode\\Tests\\SubFolder';
            const _class = 'LeadingCommentsTest';

            beforeAll(async () => {
                const buffer = await readFile(file);
                suites = parse(buffer.toString(), file)!;
            });

            it('it should parse firstLeadingComments', () => {
                const method = 'firstLeadingComments';

                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 10, character: 4 },
                        end: { line: 13, character: 5 },
                    })
                );
            });
        });

        describe('parse UseTraitTest', () => {
            const file = phpUnitProject('tests/SubFolder/UseTraitTest.php');
            const namespace = 'Recca0120\\VSCode\\Tests\\SubFolder';
            const _class = 'UseTraitTest';

            beforeAll(async () => {
                const buffer = await readFile(file);
                suites = parse(buffer.toString(), file)!;
            });

            it('it should parse use_trait', () => {
                const method = 'use_trait';
                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 12, character: 4 },
                        end: { line: 15, character: 5 },
                    })
                );
            });
        });

        describe('parse AttributeTest', () => {
            const file = phpUnitProject('tests/AttributeTest.php');
            const namespace = 'Recca0120\\VSCode\\Tests';
            const _class = 'AttributeTest';

            beforeAll(async () => {
                const buffer = await readFile(file);
                suites = parse(buffer.toString(), file)!;
            });

            it('parse Test Attribute', () => {
                const method = 'hi';
                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 14, character: 4 },
                        end: { line: 17, character: 5 },
                    })
                );
            });

            it('parse DataProvider Attribute', () => {
                const method = 'testAdd';
                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        annotations: { dataProvider: ['additionProvider'] },
                        start: { line: 20, character: 4 },
                        end: { line: 23, character: 5 },
                    })
                );
            });

            it('parse Depends Attribute', () => {
                const method = 'testPush';
                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        annotations: { depends: ['testEmpty'] },
                        start: { line: 44, character: 4 },
                        end: { line: 51, character: 5 },
                    })
                );
            });

            it('parse TestDox Attribute', () => {
                const method = 'balanceIsInitiallyZero';
                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        annotations: { testdox: ['has an initial balance of zero'] },
                        start: { line: 55, character: 4 },
                        end: { line: 58, character: 5 },
                    })
                );
            });
        });

        describe('parse NoNamespaceTest', () => {
            const file = phpUnitProject('tests/NoNamespaceTest.php');
            const namespace = '';
            const _class = 'NoNamespaceTest';

            beforeAll(async () => {
                const file2 = phpUnitProject('tests/AttributeTest.php');
                const buffer2 = await readFile(file2);
                suites = parse(buffer2.toString(), file2)!;

                const buffer = await readFile(file);
                suites = parse(buffer.toString(), file)!;
            });

            it('parse NoNamespaceTest', () => {
                const method = 'test_no_namespace';
                expect(givenTest(method)).toEqual(
                    expect.objectContaining({
                        file,
                        id: uniqueId(namespace, _class, method),
                        qualifiedClass: qualifiedClass(namespace, _class),
                        namespace,
                        class: _class,
                        method,
                        start: { line: 7, character: 4 },
                        end: { line: 10, character: 5 },
                    })
                );
            });
        });
    });

    // describe('PEST', () => {
    //     let suites: Test[];
    //     describe('parse AssertionsTest', () => {
    //         const file = pestProject('tests/Feature/ExampleTest.php');
    //         beforeAll(async () => {
    //             const buffer = await readFile(file);
    //             suites = parse(buffer.toString(), file)!;
    //         });
    //
    //         it('parse example', () => {});
    //     });
    // });
});
