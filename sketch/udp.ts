const l = Deno.listenDatagram({ port: 10000, transport: "udp" });
console.log("Listening", l.addr);
for await (const r of l) {
  const [data, addr] = r;
  console.log(new TextDecoder().decode(data), addr);
}
