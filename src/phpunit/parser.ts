import { Class, Declaration, Engine, Method, Namespace, Node, Program, UseGroup } from 'php-parser';

const engine = new Engine({
    ast: { withPositions: true, withSource: true },
    parser: { extractDoc: true, suppressErrors: false },
    lexer: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        all_tokens: true,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        short_tags: true,
    },
});

type TestAttr = {
    id: string;
    qualifiedClass: string;
    namespace: string;
    class?: string;
    method?: string;
    start: Position;
    end: Position;
    annotations: Annotations;
};

type Annotations = {
    [p: string]: unknown;
    depends?: string[];
    dataProvider?: string[];
    testdox?: string[];
};

type Position = {
    character: number;
    line: number;
};

// const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const getName = (ast: Namespace | Class | Declaration) => {
    return typeof ast.name === 'string' ? ast.name : ast.name.name;
};

class AttributeParser {
    parse(declaration: any): any[] {
        if (!declaration.hasOwnProperty('attrGroups')) {
            return [];
        }

        return declaration.attrGroups.reduce((attributes: any[], group: any) => {
            return [
                ...attributes,
                ...group.attrs.map((attr: any) => {
                    return {
                        name: attr.name,
                        args: attr.args.map((arg: any) => arg.value),
                    };
                }),
            ];
        }, []);
    }
}

class AnnotationParser {
    private static attributeParser = new AttributeParser();
    private readonly lookup = ['depends', 'dataProvider', 'testdox'];
    private readonly template = (annotation: string) =>
        `@${annotation}\\s+(?<${annotation}>[^\\n]+)`;

    private readonly pattern: RegExp = new RegExp(
        this.lookup.map((name) => this.template(name)).join('|'),
        'g'
    );

    private get attributeParser() {
        return AnnotationParser.attributeParser;
    }

    public parse(declaration: Declaration): Annotations {
        return { ...this.parseComments(declaration), ...this.parseAttributes(declaration) };
    }

    private parseAttributes(declaration: Declaration) {
        const parsed = this.attributeParser.parse(declaration);
        const annotations = {} as Annotations;

        for (const property of this.lookup) {
            const values = parsed
                .filter((attribute: any) => new RegExp(property, 'i').test(attribute.name))
                .map((attribute: any) => attribute.args[0]);

            if (values.length > 0) {
                annotations[property] = values;
            }
        }

        return annotations;
    }

    private parseComments(declaration: Declaration) {
        const comments = declaration.leadingComments ?? [];

        return comments
            .map((comment) => comment.value.matchAll(this.pattern))
            .reduce((result, matches) => this.append(result, matches), {} as Annotations);
    }

    private append(annotations: Annotations | any, matches: IterableIterator<RegExpMatchArray>) {
        for (let match of matches) {
            const groups = match!.groups;
            for (const property in groups) {
                const value = groups[property];
                if (value) {
                    annotations[property] = [...(annotations[property] ?? []), value.trim()];
                }
            }
        }

        return annotations;
    }
}

export class TestAttrParser {
    private static readonly annotationParser = new AnnotationParser();
    private readonly lookup: { [p: string]: Function } = {
        namespace: this.parseNamespace,
        class: this.parseClass,
        method: this.parseMethod,
    };

    private get annotationParser() {
        return TestAttrParser.annotationParser;
    }

    public uniqueId(namespace?: string, _class?: string, method?: string) {
        if (!_class) {
            return namespace;
        }

        let uniqueId = this.qualifiedClass(namespace, _class);
        if (method) {
            uniqueId = `${uniqueId}::${method}`;
        }

        return uniqueId;
    }

    public qualifiedClass(namespace?: string, _class?: string) {
        return [namespace, _class].filter((name) => !!name).join('\\');
    }

    public parse(declaration: Declaration, namespace?: Namespace, _class?: Class): TestAttr {
        const fn = this.lookup[declaration.kind];
        const parsed = fn.apply(this, [declaration, namespace, _class]);
        const annotations = this.annotationParser.parse(declaration);
        const { start, end } = this.parsePosition(declaration);
        const id = this.uniqueId(parsed.namespace, parsed.class, parsed.method);
        const qualifiedClass = this.qualifiedClass(parsed.namespace, parsed.class);

        return {
            id,
            qualifiedClass,
            ...parsed,
            start,
            end,
            annotations,
        };
    }

    private parseNamespace(declaration: Declaration) {
        return { namespace: this.parseName(declaration) ?? '' };
    }

    private parseClass(declaration: Declaration, namespace?: Namespace) {
        return { namespace: this.parseName(namespace) ?? '', class: this.parseName(declaration) };
    }

    private parseMethod(declaration: Declaration, namespace?: Namespace, _class?: Class) {
        return {
            namespace: this.parseName(namespace) ?? '',
            class: this.parseName(_class),
            method: this.parseName(declaration),
        };
    }

    private parsePosition(declaration: Declaration) {
        const loc = declaration.loc!;
        const start = { line: loc.start.line, character: loc.start.column };
        const end = { line: loc.end.line, character: loc.end.column };

        return { start, end };
    }

    private parseName(declaration?: Namespace | Class | Declaration) {
        return declaration ? getName(declaration) : undefined;
    }
}

class Validator {
    private static attributeParser = new AttributeParser();
    private lookup: { [p: string]: Function } = {
        class: this.validateClass,
        method: this.validateMethod,
    };

    private get attributeParser() {
        return Validator.attributeParser;
    }

    public isTest(classOrMethod: Class | Method) {
        const fn = this.lookup[classOrMethod.kind];

        return fn ? fn.apply(this, [classOrMethod]) : false;
    }

    private validateClass(_class: Class) {
        return !this.isAbstract(_class);
    }

    private validateMethod(method: Method) {
        if (this.isAbstract(method) || !this.acceptModifier(method)) {
            return false;
        }

        return (
            getName(method).startsWith('test') ||
            this.isAnnotationTest(method) ||
            this.isAttributeTest(method)
        );
    }

    private isAbstract(classOrMethod: Class | Method) {
        return classOrMethod.isAbstract;
    }

    private isAttributeTest(method: Method) {
        if (!method.attrGroups) {
            return false;
        }

        return this.attributeParser
            .parse(method)
            .some((attribute: any) => attribute.name === 'Test');
    }

    private isAnnotationTest(method: Method) {
        return !method.leadingComments
            ? false
            : new RegExp('@test').test(
                  method.leadingComments.map((comment) => comment.value).join('\n')
              );
    }

    private acceptModifier(method: Method) {
        return ['', 'public'].indexOf(method.visibility) !== -1;
    }
}

class Parser {
    private namespace?: Namespace;
    private static readonly validator = new Validator();
    private static readonly testAttrParser = new TestAttrParser();

    private lookup: { [p: string]: Function } = {
        namespace: this.parseNamespace,
        class: this.parseClass,
    };

    public parse(text: Buffer | string, file: string) {
        this.namespace = undefined;
        text = text.toString();

        // Todo https://github.com/glayzzle/php-parser/issues/170
        text = text.replace(/\?>\r?\n<\?/g, '?>\n___PSEUDO_INLINE_PLACEHOLDER___<?');

        try {
            const ast = engine.parseCode(text, file);

            // https://github.com/glayzzle/php-parser/issues/155
            // currently inline comments include the line break at the end, we need to
            // strip those out and update the end location for each comment manually
            ast.comments?.forEach((comment) => {
                if (comment.value[comment.value.length - 1] === '\r') {
                    comment.value = comment.value.slice(0, -1);
                    comment.loc!.end.offset = comment.loc!.end.offset - 1;
                }
                if (comment.value[comment.value.length - 1] === '\n') {
                    comment.value = comment.value.slice(0, -1);
                    comment.loc!.end.offset = comment.loc!.end.offset - 1;
                }
            });

            return this.parseAst(ast, file);
        } catch (e) {
            return undefined;
        }
    }

    private isTest(classOrMethod: Class | Method) {
        return Parser.validator.isTest(classOrMethod);
    }

    private parseAttributes(declaration: Declaration, _namespace?: Namespace, _class?: Class) {
        return Parser.testAttrParser.parse(declaration, _namespace, _class);
    }

    private parseAst(
        ast: Program | Namespace | UseGroup | Class | Node,
        file: string
    ): Test[] | undefined {
        const fn: Function = this.lookup[ast.kind] ?? this.parseChildren;

        return fn.apply(this, [ast, file]);
    }

    private parseNamespace(ast: Namespace, file: string) {
        // new TestCase(file, this.parseAttributes(ast as Declaration, this.namespace));

        return this.parseChildren((this.namespace = ast), file);
    }

    private parseClass(ast: Class, file: string) {
        const _class = ast;

        if (!this.isTest(_class)) {
            return [];
        }

        const attributes = this.parseAttributes(ast as Declaration, this.namespace);
        const suite = new Test(file, attributes);

        suite.children = _class.body
            .filter((method) => this.isTest(method as Method))
            .map((method) => {
                const attributes = this.parseAttributes(method, this.namespace, _class);
                const test = new Test(file, attributes);
                test.parent = suite;

                return test;
            });

        return suite.children.length > 0 ? [suite] : undefined;
    }

    private parseChildren(ast: Program | Namespace | UseGroup | Class | Node, file: string) {
        if ('children' in ast) {
            return ast.children.reduce(
                (tests, children: Node) => tests.concat(this.parseAst(children, file) ?? []),
                [] as Test[]
            );
        }

        return;
    }
}

export class Test implements TestAttr {
    public readonly id!: string;
    public readonly qualifiedClass!: string;
    public readonly namespace!: string;
    public readonly class?: string;
    public readonly method?: string;
    public readonly start!: Position;
    public readonly end!: Position;
    public readonly annotations!: Annotations;
    public parent?: Test;
    public children: Test[] = [];

    constructor(public readonly file: string, attributes: TestAttr) {
        Object.assign(this, attributes);
    }
}

const parser = new Parser();

export const parse = (buffer: Buffer | string, file: string) => parser.parse(buffer, file);
