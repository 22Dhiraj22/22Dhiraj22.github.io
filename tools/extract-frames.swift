// Extract every frame of a clip as JPEGs, optionally cropped horizontally.
// usage: swift extract-frames.swift <video> <outDir> <maxWidth> [cropLeft 0..1] [cropRight 0..1]
import AVFoundation
import AppKit
let a = CommandLine.arguments
let url = URL(fileURLWithPath: a[1]), out = a[2], width = Double(a[3])!
let cl = a.count > 4 ? Double(a[4])! : 0, cr = a.count > 5 ? Double(a[5])! : 1
let asset = AVURLAsset(url: url)
let track = asset.tracks(withMediaType: .video)[0]
let fps = Double(track.nominalFrameRate), dur = CMTimeGetSeconds(asset.duration)
let n = Int((dur * fps).rounded(.down))
let gen = AVAssetImageGenerator(asset: asset)
gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
for i in 0..<n {
  let t = CMTime(seconds: (Double(i) + 0.5) / fps, preferredTimescale: 6000)
  guard let full = try? gen.copyCGImage(at: t, actualTime: nil) else { continue }
  let x = Int(Double(full.width) * cl), w = Int(Double(full.width) * (cr - cl))
  let crop = full.cropping(to: CGRect(x: x, y: 0, width: w, height: full.height))!
  let scale = min(1, width / Double(w))
  let tw = Int(Double(w) * scale), th = Int(Double(full.height) * scale)
  let ctx = CGContext(data: nil, width: tw, height: th, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  ctx.interpolationQuality = .high
  ctx.draw(crop, in: CGRect(x: 0, y: 0, width: tw, height: th))
  let data = NSBitmapImageRep(cgImage: ctx.makeImage()!).representation(using: .jpeg, properties: [.compressionFactor: 0.6])!
  try! data.write(to: URL(fileURLWithPath: String(format: "%@/%03d.jpg", out, i)))
}
print("fps \(fps) frames \(n)")
