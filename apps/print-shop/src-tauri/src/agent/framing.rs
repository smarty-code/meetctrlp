use tokio::io::{AsyncReadExt, AsyncWriteExt};

const MAX_FRAME_BYTES: usize = 16 * 1024 * 1024;

pub async fn write_frame<W: AsyncWriteExt + Unpin>(
    writer: &mut W,
    payload: &[u8],
) -> std::io::Result<()> {
    if payload.len() > MAX_FRAME_BYTES {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "frame too large",
        ));
    }

    let len = u32::try_from(payload.len()).map_err(|_| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "frame too large")
    })?;
    writer.write_all(&len.to_le_bytes()).await?;
    writer.write_all(payload).await?;
    writer.flush().await
}

pub async fn read_frame<R: AsyncReadExt + Unpin>(reader: &mut R) -> std::io::Result<Vec<u8>> {
    let mut header = [0_u8; 4];
    reader.read_exact(&mut header).await?;
    let len = u32::from_le_bytes(header) as usize;
    if len > MAX_FRAME_BYTES {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "frame too large",
        ));
    }

    let mut payload = vec![0_u8; len];
    reader.read_exact(&mut payload).await?;
    Ok(payload)
}
