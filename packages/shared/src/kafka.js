import { Kafka, logLevel } from 'kafkajs';

export function createKafka(clientId) {
  return new Kafka({
    clientId,
    brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    logLevel: logLevel.WARN,
    retry: { retries: 8 },
  });
}
