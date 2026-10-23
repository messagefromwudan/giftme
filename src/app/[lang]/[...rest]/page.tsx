import { notFound } from "next/navigation";

// Any unknown URL lands here (the proxy rewrites it under /ro/…), so it gets the branded 404.
export default function CatchAll() {
  notFound();
}
