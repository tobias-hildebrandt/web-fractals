/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as common from "./common"; // only for typescript warnings?
import 'regenerator-runtime/runtime'; // for async, needed by babel

// typescript linting workaround
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendMessage: any = self.postMessage;

onmessage = async (message) => {
    const common = await import("./common");
    const fractals = await import("../../pkg");
    // console.log(`worker sees ${JSON.stringify(message.data)}`);

    fractals.init(); // set up panic handler

    const request = message.data as unknown as common.RequestMessage;
    console.log(`worker ${request.idNumber} starting pass ${request.pass}`);

    const parsed: common.Inputs = JSON.parse(request.inputsJSON) as common.Inputs;
    const args = common.inputsToArgs(parsed);

    if (request.pass == 1) {
        // arrays are located in JS memory
        const imageData: Uint8Array = new Uint8Array(request.pixelsPerBatch * 4);
        const results: Int32Array = new Int32Array(request.pixelsPerBatch);

        // passed via reference (&mut [u8]) to wasm, no copying is done
        const min = fractals.render_mandlebrot(imageData, results, args, request.idNumber * request.pixelsPerBatch, request.pixelsPerBatch);

        const message: common.FirstPassResponseMessage = {
            results: results,
            min: min!,
            idNumber: request.idNumber,
            pass: request.pass,
            imageData: new Uint8ClampedArray(imageData.buffer)
        };
        sendMessage(message, [results.buffer, imageData.buffer]);
    } else if (request.pass == 2) {
        const secondPassRequest: common.SecondPassRequestMessage = request as common.SecondPassRequestMessage;
        const castedImageData = new Uint8Array(secondPassRequest.imageData.buffer); // just makes a new view, does not allocate
        fractals.second_round(castedImageData, secondPassRequest.results, args, request.idNumber * request.pixelsPerBatch, request.pixelsPerBatch, secondPassRequest.min);
        const message: common.ResponseMessage = {
            idNumber: request.idNumber,
            pass: request.pass,
            imageData: secondPassRequest.imageData
        };
        sendMessage(message, [secondPassRequest.imageData.buffer]); // original array is still valid
    } else {
        console.log(`worker ${request.idNumber} got a unrecognized pass number: ${request.pass}`);
    }
    console.log(`worker ${request.idNumber} finished pass ${request.pass}`);
}

onmessageerror = e => {
    console.log(`worker encountered error: ${e}`);
}