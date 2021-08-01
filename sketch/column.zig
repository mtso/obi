const std = @import("std");

pub fn main() !void {
    _ = try std.io.getStdOut().writer().write("hi");
}
