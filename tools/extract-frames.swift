import AVFoundation
import AppKit
let url = URL(fileURLWithPath: CommandLine.arguments[1]); let out = CommandLine.arguments[2]
let n = Int(CommandLine.arguments[3])!; let width = Double(CommandLine.arguments[4])!
let asset = AVURLAsset(url: url)
let gen = AVAssetImageGenerator(asset: asset)
gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
gen.maximumSize = CGSize(width: width, height: width)
let dur = CMTimeGetSeconds(asset.duration)
for i in 0..<n {
  let t = CMTime(seconds: 0.02 + (dur - 0.1) * Double(i) / Double(n - 1), preferredTimescale: 600)
  let cg = try! gen.copyCGImage(at: t, actualTime: nil)
  let data = NSBitmapImageRep(cgImage: cg).representation(using: .jpeg, properties: [.compressionFactor: 0.78])!
  try! data.write(to: URL(fileURLWithPath: String(format: "%@/%03d.jpg", out, i)))
}
