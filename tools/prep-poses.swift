// Crop + compress pose images (from tools/pose-grid.py) into hero frames.
// usage: swift prep-poses.swift <inDir> <outDir> <maxWidth> <cropLeft 0..1> <cropRight 0..1>
// Also paints over the generator's sparkle watermark (bottom-right) with the backdrop colour.
import AppKit
let a = CommandLine.arguments
let inDir = a[1], out = a[2], width = Double(a[3])!, cl = Double(a[4])!, cr = Double(a[5])!
let files = try! FileManager.default.contentsOfDirectory(atPath: inDir).filter { $0.hasSuffix(".png") }.sorted()
for f in files {
  let src = NSImage(contentsOfFile: "\(inDir)/\(f)")!
  let full = src.cgImage(forProposedRect: nil, context: nil, hints: nil)!
  let x = Int(Double(full.width) * cl), w = Int(Double(full.width) * (cr - cl))
  let crop = full.cropping(to: CGRect(x: x, y: 0, width: w, height: full.height))!
  let s = min(1, width / Double(w)), tw = Int(Double(w) * s), th = Int(Double(full.height) * s)
  let ctx = CGContext(data: nil, width: tw, height: th, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  ctx.interpolationQuality = .high
  ctx.draw(crop, in: CGRect(x: 0, y: 0, width: tw, height: th))
  // watermark sits around (1160, 600) in the 1280x720 source; CG origin is bottom-left
  let wx = (1160 - Double(x)) * s, wy = Double(th) - 600 * s, r = 34 * s
  // fill colour = average of the backdrop just left of the watermark (bitmap rows run top-down)
  let px = ctx.data!.assumingMemoryBound(to: UInt8.self), row = ctx.bytesPerRow
  var sum = [0.0, 0.0, 0.0], n = 0.0
  for dy in stride(from: -Int(r), through: Int(r), by: 4) { for dx in 4...12 {
    let p = (Int(600 * s) + dy) * row + (Int(wx - r) - dx) * 4
    for k in 0..<3 { sum[k] += Double(px[p + k]) }; n += 1 } }
  ctx.setFillColor(CGColor(red: sum[0] / n / 255, green: sum[1] / n / 255, blue: sum[2] / n / 255, alpha: 1))
  ctx.fill(CGRect(x: wx - r, y: wy - r, width: 2 * r, height: 2 * r))
  let data = NSBitmapImageRep(cgImage: ctx.makeImage()!).representation(using: .jpeg, properties: [.compressionFactor: 0.62])!
  try! data.write(to: URL(fileURLWithPath: "\(out)/\(f.replacingOccurrences(of: ".png", with: ".jpg"))"))
}
print("\(files.count) frames")
