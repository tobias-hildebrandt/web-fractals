import React from "react";
import ReactDOM from "react-dom";

interface ComplexStrings {
    real: string,
    imaginary: string,
}

interface ComplexNumber {
    real: number,
    imaginary: number,
}

function isDecimalString(s: string) {
    return !isNaN(+s) && isFinite(+s) && !/e/i.test(s)
}

function complexNumberToStrings(complex: ComplexNumber): ComplexStrings {
    return {
        real: `${complex.real}`,
        imaginary: `${complex.imaginary}`,
    };
}

interface StringInputProps {
    handleChange: (str: string) => void,
    str: string,
}

const StringInputType = "number-input";
class StringInput extends React.Component<StringInputProps> { // <props>
    constructor(props: StringInputProps) {
        super(props);
    }

    handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.props.handleChange(
            event.target.value
        );
    }

    render() {
        return (
            <input
                className={StringInputType}
                type="text"
                onInput={this.handleChange.bind(this)}
                value={this.props.str}
            />
        );
    }
}

interface PositiveIntInputProps {
    handleChange: (num: number) => void,
    value: number,
}

const PositiveIntInputType = "number-input";
class PositiveIntInput extends React.Component<PositiveIntInputProps> {
    constructor(props: PositiveIntInputProps) {
        super(props);
    }

    handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.props.handleChange(
            Number.parseInt(event.target.value) || 1
        );
    }

    render() {
        return (
            <div className={PositiveIntInputType}>
                <input
                    type="number"
                    value={this.props.value}
                    step="1"
                    min="1"
                    onChange={(event) => this.handleChange(event)}
                />
            </div>
        )
    }
}

interface BooleanInputProps {
    handleChange: (b: boolean) => void,
    value: boolean,
}

const BooleanInputType = "number-input";
class BooleanInput extends React.Component<BooleanInputProps> {
    constructor(props: BooleanInputProps) {
        super(props);
    }

    handleChange(event: React.ChangeEvent<HTMLInputElement>) {
        this.props.handleChange(
            event.target.checked
        );
    }

    render() {
        return (
            <div className={BooleanInputType}>
                <input
                    type="checkbox"
                    checked={this.props.value}
                    onChange={(event) => this.handleChange(event)}
                />
            </div>
        )
    }
}

type PartialComplexString = { real: string } | { imaginary: string };

interface ComplexNumberInputProps {
    initialComplex: ComplexStrings,
    update: (complex: ComplexStrings) => void,
}

const ComplexNumberInputType = "complex-number-input";
class ComplexNumberInput extends React.Component<ComplexNumberInputProps, ComplexStrings> { // <props, state>
    constructor(props: ComplexNumberInputProps) {
        super(props);

        this.state = {
            ...this.props.initialComplex
        };
    }

    handleChange(partial: PartialComplexString) {
        this.setState({
            ...this.state,
            ...partial
        }, () => {
            this.props.update(this.state);
        });
    }

    render() {
        const realInputElem = (
            <StringInput
                str={this.state.real}
                handleChange={(str) => this.handleChange({ real: str })} />
        );

        const imaginaryInputElem = (
            <StringInput
                str={this.state.imaginary}
                handleChange={(str) => this.handleChange({ imaginary: str })} />
        );

        return (
            <div className={ComplexNumberInputType}>
                ({realInputElem} + {imaginaryInputElem}i)
            </div>
        );
    }
}

interface Inputs {
    start: ComplexNumber,
    end: ComplexNumber,
    maxIterations: number,
    width: number,
    height: number,
    keepRatio: boolean,
}

interface AllInputsFormState {
    start: ComplexStrings,
    end: ComplexStrings,
    maxIterations: number,
    width: number,
    height: number,
    keepRatio: boolean,
}

interface AllInputsFormsProps {
    inputsState: AllInputsFormState,
    updateInputsState: <Partial extends keyof AllInputsFormState>(newState: Pick<AllInputsFormState, Partial>) => void,
    startRender: () => void
}

enum WhichComplexUpdate {
    START,
    END,
}

const AllInputsFormType = "all-inputs";
class AllInputsForm extends React.Component<AllInputsFormsProps> {
    constructor(props: AllInputsFormsProps) {
        super(props);
    }

    updateComplex(which: WhichComplexUpdate, complex: ComplexStrings) {
        switch (which) {
            case WhichComplexUpdate.START:
                this.props.updateInputsState({
                    start: complex
                });
                break;
            case WhichComplexUpdate.END:
                this.props.updateInputsState({
                    end: complex
                });
                break;
        }
    }

    formSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault(); // do not reload page

        // guard condition
        if (
            !isDecimalString(this.props.inputsState.start.imaginary) ||
            !isDecimalString(this.props.inputsState.start.real) ||
            !isDecimalString(this.props.inputsState.end.imaginary) ||
            !isDecimalString(this.props.inputsState.end.real)
        ) {
            alert("invalid input in complex numbers");
            return;
        }

        this.props.startRender();
    }

    render() {
        return (
            <form className={AllInputsFormType} onSubmit={(event) => this.formSubmit(event)}>
                Start:
                <ComplexNumberInput
                    initialComplex={this.props.inputsState.start}
                    update={(complex) => this.updateComplex(WhichComplexUpdate.START, complex)}
                />
                End:
                <ComplexNumberInput
                    initialComplex={this.props.inputsState.end}
                    update={(complex) => this.updateComplex(WhichComplexUpdate.END, complex)}
                />
                Canvas Width:
                <PositiveIntInput
                    handleChange={(num) => { this.props.updateInputsState({ width: num }) }}
                    value={this.props.inputsState.width}
                />
                Canvas Height:
                <PositiveIntInput
                    handleChange={(num) => { this.props.updateInputsState({ height: num }) }}
                    value={this.props.inputsState.height}
                />
                Max Iterations:
                <PositiveIntInput
                    handleChange={(num) => { this.props.updateInputsState({ maxIterations: num }) }}
                    value={this.props.inputsState.maxIterations}
                />
                Keep Ratio:
                <BooleanInput
                    handleChange={(b) => { this.props.updateInputsState({ keepRatio: b }) }}
                    value={this.props.inputsState.keepRatio}
                />
                <input type="submit" value="submit inputs" />
            </form>
        );
    }
}

interface AppProps {
    defaultInputs: Inputs,
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Status {
    // TODO
    // workersCreated: number,
    // workersNeeded: number,
    // workersActive: number,
    // workersCompleted: number,
}

const StatusDisplayType = "status-display";
class StatusDisplay extends React.Component<Status> {
    constructor(props: Status) {
        super(props);
    }

    render() {
        return ( // TODO
            <div className={StatusDisplayType}>
                Status:
                <div>(status placeholder)</div>
            </div>
        )
    }
}

class DrawCanvas extends React.Component {

    render() {
        return (
            <canvas width="500" height="500"
            />
        )
    }
}

class CanvasesDisplay extends React.Component {

    render() {
        return (
            <div>
                <DrawCanvas />
            </div>
        )
    }
}

interface AppState {
    renderedInputs: Inputs | null,
    currentInputsState: AllInputsFormState,
    status: Status
}

const AppType = "app";
class App extends React.Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            renderedInputs: null,
            currentInputsState: {
                start: complexNumberToStrings(props.defaultInputs.start),
                end: complexNumberToStrings(props.defaultInputs.end),
                maxIterations: props.defaultInputs.maxIterations,
                width: props.defaultInputs.width,
                height: props.defaultInputs.height,
                keepRatio: props.defaultInputs.keepRatio,
            },
            status: {} // TODO
        }
    }

    startRender() {
        // TODO

        // parse complex strings here
        console.log(this.state.currentInputsState);
    }

    updateCurrentInputs<Partial extends keyof AllInputsFormState>(newState: Pick<AllInputsFormState, Partial>) {
        this.setState({
            currentInputsState: {
                ...this.state.currentInputsState,
                ...newState
            }
        });
    }

    render() {
        return (
            <div className={AppType}>
                <div>Hello React!</div>
                <StatusDisplay />
                <AllInputsForm
                    inputsState={this.state.currentInputsState}
                    updateInputsState={(newState) => this.updateCurrentInputs(newState)}
                    startRender={() => this.startRender()}
                />
            </div>
        );
    }
}

const DEFAULT_INPUTS: Inputs = {
    start: {
        real: -2.5,
        imaginary: -2.5,
    },
    end: {
        real: 2.5,
        imaginary: 2.5,
    },
    maxIterations: 2000,
    width: 500,
    height: 500,
    keepRatio: true,
}

export function startReact() {
    ReactDOM.render(<App defaultInputs={DEFAULT_INPUTS} />, document.getElementById("test-react"));
}