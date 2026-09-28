using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using Ctrlp.PrintAgent.Contracts;

namespace Ctrlp.PrintAgent.Windows;

public sealed class WindowsCredentialStore : ISecretStore
{
    public const string RefreshTokenTarget = "Ctrlp.PrintShop/refreshToken";
    private const uint CredentialTypeGeneric = 1;
    private const uint PersistLocalMachine = 2;

    public string? GetRefreshToken()
    {
        if (!CredRead(RefreshTokenTarget, CredentialTypeGeneric, 0, out var pointer))
        {
            return null;
        }

        try
        {
            var credential = Marshal.PtrToStructure<NativeCredential>(pointer);
            if (credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0)
            {
                return null;
            }

            return Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2)
                ?.TrimEnd('\0');
        }
        finally
        {
            CredFree(pointer);
        }
    }

    public void SetRefreshToken(string refreshToken)
    {
        var bytes = Encoding.Unicode.GetBytes(refreshToken);
        var blob = Marshal.AllocHGlobal(bytes.Length);
        try
        {
            Marshal.Copy(bytes, 0, blob, bytes.Length);
            var credential = new NativeCredential
            {
                Type = CredentialTypeGeneric,
                TargetName = RefreshTokenTarget,
                Comment = "MeetCtrlP print shop refresh token",
                CredentialBlobSize = (uint)bytes.Length,
                CredentialBlob = blob,
                Persist = PersistLocalMachine,
                UserName = "Ctrlp.PrintShop",
            };

            if (!CredWrite(ref credential, 0))
            {
                throw new InvalidOperationException($"CredWrite failed ({Marshal.GetLastWin32Error()}).");
            }
        }
        finally
        {
            Marshal.FreeHGlobal(blob);
        }
    }

    public void ClearRefreshToken()
    {
        CredDelete(RefreshTokenTarget, CredentialTypeGeneric, 0);
    }

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredWrite(ref NativeCredential credential, uint flags);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredDelete(string target, uint type, uint flags);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern void CredFree(IntPtr buffer);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct NativeCredential
    {
        public uint Flags;
        public uint Type;
        public string? TargetName;
        public string? Comment;
        public FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public string? TargetAlias;
        public string? UserName;
    }
}
