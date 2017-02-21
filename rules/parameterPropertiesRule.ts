import * as ts from 'typescript';
import * as Lint from 'tslint';
import * as utils from 'tsutils';

import { AbstractConfigDependentRule } from '../src/rules';
import { ConstructorDeclarationWalker } from '../src/walker';

const ALL_OR_NONE_OPTION = 'all-or-none';
const LEADING_OPTION = 'leading';
const READONLY_OPTION = 'readonly';
const MEMBER_ACCESS_OPTION = 'member-access';

const ALL_OR_NONE_FAIL = 'don\'t mix parameter properties with regular parameters';
const LEADING_FAIL = 'parameter properties must precede regular parameters';
const READONLY_FAIL = 'parameter property must be readonly';
const MEMBER_ACCESS_FAIL = 'parameter property must have access modifier';

// TODO
//  - no parameter use
//  - no reassign
//   - no reassign parameter
//   - no reassign property
//  - no reassign readonly
//   - no reassign readonly parameter
//   - no reassign readonly property

export class Rule extends AbstractConfigDependentRule {
    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ParameterPropertyWalker(sourceFile, this.getOptions()));
    }
}

class ParameterPropertyWalker extends ConstructorDeclarationWalker {
    private _allOrNone: boolean;
    private _leading: boolean;
    private _readOnly: boolean;
    private _memberAccess: boolean;

    constructor(sourceFile: ts.SourceFile, options: Lint.IOptions) {
        super(sourceFile, options);
        const args = options.ruleArguments!;

        this._allOrNone = args.indexOf(ALL_OR_NONE_OPTION) !== -1;
        this._leading = args.indexOf(LEADING_OPTION) !== -1;
        this._readOnly = args.indexOf(READONLY_OPTION) !== -1;
        this._memberAccess = args.indexOf(MEMBER_ACCESS_OPTION) !== -1;
    }

    public visitConstructorDeclaration(node: ts.ConstructorDeclaration) {
        const parameters = node.parameters;
        const length = parameters.length;
        if (length === 0)
            return;

        let index = -1;
        for (let i = 0; i < length; ++i) {
            if (utils.isParameterProperty(parameters[i])) {
                index = i;
                break;
            }
        }
        if (index === -1)
            return;

        if (this._allOrNone) {
            const start = parameters[0].getStart(this.getSourceFile());
            const end = parameters[parameters.length - 1].getEnd();
            if (index > 0) {
                this.addFailureFromStartToEnd(start, end, ALL_OR_NONE_FAIL);
            } else {
                for (let i = index + 1; i < length; ++i) {
                    if (!utils.isParameterProperty(parameters[i])) {
                        this.addFailureFromStartToEnd(start, end, ALL_OR_NONE_FAIL);
                        break;
                    }
                }
            }
        } else if (this._leading) {
            let regular = index > 0;
            for (let i = index; i < length; ++i) {
                if (utils.isParameterProperty(parameters[i])) {
                    if (regular)
                        this.addFailureAtNode(parameters[i], LEADING_FAIL);
                } else {
                    regular = true;
                }
            }
        }

        if (this._memberAccess) {
            for (let i = index; i < length; ++i) {
                const parameter = parameters[i];
                if (utils.isParameterProperty(parameter) && !utils.hasAccessModifier(parameter))
                    this.addFailureAtNode(parameter, MEMBER_ACCESS_FAIL);
            }
        }

        if (this._readOnly) {
            for (let i = index; i < length; ++i) {
                const parameter = parameters[i];
                if (utils.isParameterProperty(parameter) && !utils.hasModifier(parameter.modifiers, ts.SyntaxKind.ReadonlyKeyword))
                    this.addFailureAtNode(parameter, READONLY_FAIL);
            }
        }
    }
}
