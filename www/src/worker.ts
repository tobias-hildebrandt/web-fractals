/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as common from "./common"; // only for typescript warnings?
// import "regenerator-runtime"; // for async, needed by babel
import 'regenerator-runtime/runtime';

// typescript linting workaround
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sendMessage: any = self.postMessage;

onmessage = async (message) => {
    const common = await import("./common");
    const fractals = await import("../../pkg")
    // console.log(`worker sees ${JSON.stringify(message.data)}`);

    const request = message.data as unknown as common.RequestMessage;
    console.log(`worker ${request.idNumber} starting pass ${request.pass}`);

    const parsed: common.Inputs = JSON.parse(request.inputsJSON) as common.Inputs;
    const args = common.inputsToArgs(parsed);

    if (request.pass == 1) {
        const imageDataArray = new Uint8ClampedArray(request.pixelsPerBatch * 4);
        const resultsArray = new Int32Array(request.pixelsPerBatch);
        const min = fractals.render_mandlebrot(imageDataArray, resultsArray, args, request.idNumber * request.pixelsPerBatch, request.pixelsPerBatch);
        const message: common.FirstPassResponseMessage = {
            results: resultsArray,
            min: min!,
            idNumber: request.idNumber,
            pass: request.pass,
            imageData: imageDataArray
        };
        sendMessage(message, [imageDataArray.buffer, resultsArray.buffer]);
    } else if (request.pass == 2) {
        const secondPassRequest: common.SecondPassRequestMessage = request as common.SecondPassRequestMessage;
        fractals.second_round(secondPassRequest.imageData, secondPassRequest.results, args, request.idNumber * request.pixelsPerBatch, request.pixelsPerBatch, secondPassRequest.min);
        const message: common.ResponseMessage = {
            idNumber: request.idNumber,
            pass: request.pass,
            imageData: secondPassRequest.imageData
        };
        sendMessage(message, [secondPassRequest.imageData.buffer]);
    } else {
        console.log(`worker ${request.idNumber} got a unrecognized pass number: ${request.pass}`);
    }
    console.log(`worker ${request.idNumber} finished pass ${request.pass}`);
}

onmessageerror = e => {
    console.log(`worker encountered error: ${e}`);
}