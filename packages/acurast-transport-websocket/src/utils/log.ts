import { serializable } from './serialization'

export function log(tag: string, ...data: any[]): void {
    console.log(tag, ...serializable(data))
}