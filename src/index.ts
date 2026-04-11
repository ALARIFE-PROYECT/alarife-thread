export function sum(param1: number, param2: number): number {
    console.log(`Parameter 1: ${param1}`);
    console.log(`Parameter 2: ${param2}`);

    return param1 + param2;
}

export const result = sum(20, 20);
