namespace Tesults.Action.Examples;

public class CalculatorTests
{
    [Fact]
    public void AddsTwoNumbers()
    {
        Assert.Equal(5, 2 + 3);
    }

    [Fact]
    public void SubtractsTwoNumbers()
    {
        Assert.Equal(3, 7 - 4);
    }
}
