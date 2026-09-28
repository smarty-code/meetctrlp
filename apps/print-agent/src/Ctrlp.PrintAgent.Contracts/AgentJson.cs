using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ctrlp.PrintAgent.Contracts;

public static class AgentJson
{
    public static JsonSerializerOptions Options { get; } = Create();

    private static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = false,
        };
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        return options;
    }

    public static JsonElement ToElement<T>(T value) =>
        JsonSerializer.SerializeToElement(value, Options);

    public static T? FromElement<T>(JsonElement? element)
    {
        if (element is null || element.Value.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            return default;
        }

        return element.Value.Deserialize<T>(Options);
    }
}
