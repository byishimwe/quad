import axios from "axios";
import { env } from "@/lib/envValidation";
import { attachInterceptors } from "./interceptors";

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
  headers: {
    "Content-Type": "application/json",
  },
});

attachInterceptors(api);
